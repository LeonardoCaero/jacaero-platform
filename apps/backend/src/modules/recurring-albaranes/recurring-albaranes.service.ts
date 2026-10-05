import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import PizZip from "pizzip";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { getCategoryFolderPath, nextDocumentNumber } from "../../common/services/nas-documents.service.js";
import { ApiError } from "../../common/errors/api-error.js";
import { orderYear } from "../email-orders/email-orders.service.js";
import {
  applyReplacements,
  extractFields,
  formatAmount,
  formatDateEs,
  setTableFont,
  monthIndex,
  monthName,
  parseAmount,
  withMonth,
  type DocKind,
} from "./docx-fields.js";
import { monthlyAmountFromLines } from "./monthly-amount.js";
import type { DraftBody } from "./recurring-albaranes.schema.js";

const execFileAsync = promisify(execFile);
const IVA = 0.21;
const KINDS: DocKind[] = ["albaran", "factura"];

async function docxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "albaran-"));
  try {
    const docxPath = path.join(dir, "doc.docx");
    await fs.writeFile(docxPath, docxBuffer);
    await execFileAsync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, docxPath], {
      timeout: 30_000,
    });
    return await fs.readFile(path.join(dir, "doc.pdf"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const docsRoot = () => {
  if (!env.DOCS_ROOT_PATH) throw new ApiError(500, "DOCS_ROOT_PATH no está configurado");
  return env.DOCS_ROOT_PATH;
};

const exists = (p: string) =>
  fs
    .access(p)
    .then(() => true)
    .catch(() => false);

const documentXml = (docx: Buffer) => new PizZip(docx).file("word/document.xml")!.asText();

const periodOf = (year: number, month: number) => new Date(Date.UTC(year, month, 1));

async function getOrder(id: string) {
  const order = await prisma.emailOrder.findUnique({
    where: { id },
    omit: { pdfAttachment: true, rawContent: true },
    include: { lines: true },
  });
  if (!order) throw new ApiError(404, "Pedido no encontrado");
  const { contractResourceId, orderNumber } = order;
  if (!contractResourceId || !orderNumber) throw new ApiError(400, "Este pedido no está vinculado a ningún recurso");
  return { ...order, contractResourceId, orderNumber };
}

type Order = Awaited<ReturnType<typeof getOrder>>;

export async function syncDocuments(orderId: string) {
  const order = await getOrder(orderId);
  const year = orderYear(order);
  const found: { kind: DocKind; period: Date; number: string; path: string; nameMismatch: boolean; at: Date }[] = [];

  for (const kind of KINDS) {
    const folder = await getCategoryFolderPath(year, kind).catch(() => null);
    if (!folder) continue;

    for (const f of await fs.readdir(folder)) {
      const nameMonth = f.match(/MES DE ([A-ZÁÉÍÓÚ]+)/i)?.[1];
      if (!/^\d+\s.*\.docx$/i.test(f) || !nameMonth) continue;

      const fullPath = path.join(folder, f);
      const xml = documentXml(await fs.readFile(fullPath));
      if (!xml.includes(order.orderNumber)) continue;

      const fileMonth = monthIndex(nameMonth);
      let contentMonth = fileMonth;
      try {
        contentMonth = monthIndex(extractFields(xml, kind).month);
      } catch {
        contentMonth = fileMonth;
      }
      if (contentMonth < 0) continue;
      found.push({
        kind,
        period: periodOf(year, contentMonth),
        number: f.match(/^(\d+)/)![1],
        path: path.relative(docsRoot(), fullPath),
        nameMismatch: fileMonth >= 0 && fileMonth !== contentMonth,
        at: (await fs.stat(fullPath)).mtime,
      });
    }
  }

  await prisma.$transaction([
    prisma.monthlyDocument.deleteMany({ where: { emailOrderId: order.id, path: { notIn: found.map((d) => d.path) } } }),
    ...found.map((d) =>
      prisma.monthlyDocument.upsert({
        where: { path: d.path },
        create: { emailOrderId: order.id, ...d },
        update: { emailOrderId: order.id, kind: d.kind, period: d.period, number: d.number, nameMismatch: d.nameMismatch },
      }),
    ),
  ]);
}

async function documentsOf(order: Order) {
  return prisma.monthlyDocument.findMany({ where: { emailOrderId: order.id }, orderBy: [{ period: "asc" }, { number: "asc" }] });
}

type MonthlyDoc = Awaited<ReturnType<typeof documentsOf>>[number];

async function templateDocument(order: Order, kind: DocKind) {
  const candidates = await prisma.monthlyDocument.findMany({
    where: { kind, emailOrder: { contractResourceId: order.contractResourceId }, nameMismatch: false },
    include: { emailOrder: { select: { id: true } } },
    orderBy: [{ period: "desc" }, { number: "desc" }],
  });
  const own = candidates.filter((d) => d.emailOrderId === order.id);
  for (const d of [...own, ...candidates.filter((c) => c.emailOrderId !== order.id)]) {
    if (await exists(path.join(docsRoot(), d.path))) return d;
  }
  return null;
}

async function summarize(doc: MonthlyDoc) {
  const fields = extractFields(documentXml(await fs.readFile(path.join(docsRoot(), doc.path))), doc.kind);
  const [base, iva, total] = fields.amounts.map((a) => a.value);
  return {
    number: fields.number.value,
    date: fields.date.value,
    conceptLines: fields.conceptLines.map((c) => c.value),
    base,
    iva,
    total,
  };
}

const samePeriod = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

const docDto = (d: MonthlyDoc) => ({
  id: d.id,
  kind: d.kind,
  period: d.period,
  number: d.number,
  filename: path.basename(d.path, ".docx"),
  nameMismatch: d.nameMismatch,
  at: d.at,
});

async function describeOrder(order: Order, period: Date) {
  const docs = await documentsOf(order);
  const selected = async (kind: DocKind) => {
    const doc = docs.filter((d) => d.kind === kind && samePeriod(d.period, period)).at(-1);
    return doc ? { ...docDto(doc), summary: await summarize(doc).catch(() => null) } : null;
  };
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    year: orderYear(order),
    documents: docs.map(docDto),
    albaran: await selected("albaran"),
    factura: await selected("factura"),
  };
}

export async function list(period: Date) {
  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", contracts: { some: { status: "ACTIVE", resources: { some: {} } } } },
    include: {
      contracts: {
        where: { status: "ACTIVE" },
        include: {
          resources: { include: { emailOrders: { select: { id: true, orderDate: true, receivedAt: true } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const year = period.getUTCFullYear();
  return Promise.all(
    clients.map(async (client) => ({
      id: client.id,
      name: client.name,
      resources: await Promise.all(
        client.contracts
          .flatMap((c) => c.resources)
          .map(async (resource) => {
            const linked = resource.emailOrders.find((o) => orderYear(o) === year);
            return {
              id: resource.id,
              name: resource.name,
              order: linked ? await describeOrder(await getOrder(linked.id), period) : null,
            };
          }),
      ),
    })),
  );
}

async function loadSource(order: Order, kind: DocKind) {
  const doc = await templateDocument(order, kind);
  if (!doc) {
    const doc = kind === "albaran" ? "albarán" : "factura";
    throw new ApiError(404, `No hay ningún ${doc} anterior de este recurso. Pulsa "Leer del NAS" para cargarlos.`);
  }
  const docx = await fs.readFile(path.join(docsRoot(), doc.path));
  const xml = documentXml(docx);
  return { docx, xml, fields: extractFields(xml, kind), filename: path.basename(doc.path, ".docx") };
}

export async function draft(orderId: string, kind: DocKind, period: Date) {
  const order = await getOrder(orderId);
  const { fields, filename } = await loadSource(order, kind);
  const month = monthName(period.getUTCMonth());
  const { number } = await nextDocumentNumber(period.getUTCFullYear(), kind);

  const fromOrder = monthlyAmountFromLines(
    order.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      deliveryDate: l.deliveryDate,
    })),
    period,
  );

  return {
    number,
    date: new Date().toISOString().slice(0, 10),
    conceptLines: fields.conceptLines.map((c) => withMonth(c.value, fields.month, month)),
    baseAmount: fromOrder?.amount ?? parseAmount(fields.amounts[0].value),
    amountSource: fromOrder?.source ?? "previous",
    title: withMonth(filename.replace(/^\d+\s*/, ""), fields.month, month),
  };
}

async function render(order: Order, kind: DocKind, body: DraftBody) {
  const { docx, xml, fields } = await loadSource(order, kind);
  if (body.conceptLines.length !== fields.conceptLines.length) {
    throw new ApiError(400, "El número de líneas de concepto no coincide con el documento");
  }

  const [base, iva, total] = fields.amounts;
  const ivaAmount = Math.round(body.baseAmount * IVA * 100) / 100;
  const replacements = [
    { paragraph: fields.number.paragraph, from: fields.number.value, to: body.number },
    { paragraph: fields.date.paragraph, from: fields.date.value, to: formatDateEs(body.date) },
    ...fields.conceptLines.map((c, i) => ({ paragraph: c.paragraph, from: c.value, to: body.conceptLines[i] })),
    { paragraph: base.paragraph, from: base.value, to: formatAmount(body.baseAmount, base.value) },
    { paragraph: iva.paragraph, from: iva.value, to: formatAmount(ivaAmount, iva.value) },
    { paragraph: total.paragraph, from: total.value, to: formatAmount(body.baseAmount + ivaAmount, total.value) },
  ];

  const zip = new PizZip(docx);
  const filled = applyReplacements(xml, replacements);
  zip.file("word/document.xml", kind === "albaran" ? setTableFont(filled, /^Nº albar[aá]n$/im, "Arial", 24) : filled);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function previewPdf(orderId: string, kind: DocKind, body: DraftBody) {
  return docxToPdf(await render(await getOrder(orderId), kind, body));
}

export async function existingPdf(documentId: string) {
  const doc = await prisma.monthlyDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new ApiError(404, "Documento no encontrado");
  const pdfPath = path.join(docsRoot(), doc.path.replace(/\.docx$/i, ".pdf"));
  if (!(await exists(pdfPath))) throw new ApiError(404, "No se encontró el PDF de este documento");
  return fs.readFile(pdfPath);
}

export async function generate(orderId: string, kind: DocKind, period: Date, body: DraftBody) {
  const order = await getOrder(orderId);
  const docx = await render(order, kind, body);
  const pdf = await docxToPdf(docx);

  const folder = await getCategoryFolderPath(period.getUTCFullYear(), kind);
  const filename = `${body.number} ${body.title}`;
  const docxPath = path.join(folder, `${filename}.docx`);
  const pdfPath = path.join(folder, `${filename}.pdf`);

  const taken = (await fs.readdir(folder)).some((f) => parseInt(f) === Number(body.number));
  if (taken || (await exists(docxPath)) || (await exists(pdfPath))) {
    throw new ApiError(409, `Ya existe un documento con el número ${body.number}`);
  }

  await fs.writeFile(docxPath, docx);
  await fs.writeFile(pdfPath, pdf);

  await prisma.monthlyDocument.create({
    data: {
      emailOrderId: order.id,
      kind,
      period,
      number: body.number,
      path: path.relative(docsRoot(), docxPath),
      at: new Date(),
    },
  });

  return { filename };
}
