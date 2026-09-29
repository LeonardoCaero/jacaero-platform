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

const pointerKeys = (kind: DocKind) =>
  kind === "albaran"
    ? ({ path: "lastAlbaranPath", period: "lastAlbaranPeriod", at: "lastAlbaranAt" } as const)
    : ({ path: "lastFacturaPath", period: "lastFacturaPeriod", at: "lastFacturaAt" } as const);

async function findLatest(orderNumber: string, kind: DocKind) {
  const year = new Date().getFullYear();
  for (const y of [year, year - 1]) {
    const folder = await getCategoryFolderPath(y, kind).catch(() => null);
    if (!folder) continue;

    const files = (await fs.readdir(folder))
      .filter((f) => /^\d+\s.*\.docx$/i.test(f))
      .sort((a, b) => parseInt(b) - parseInt(a));

    for (const f of files) {
      const xml = documentXml(await fs.readFile(path.join(folder, f)));
      if (!xml.includes(orderNumber) || !/MES DE/.test(xml)) continue;
      const fields = extractFields(xml, kind);
      return {
        relPath: path.relative(docsRoot(), path.join(folder, f)),
        period: new Date(Date.UTC(y, monthIndex(fields.month), 1)),
      };
    }
  }
  return null;
}

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
type Pointer = { relPath: string; period: Date | null; at: Date | null };
type PointerFields = {
  lastAlbaranPath: string | null;
  lastAlbaranPeriod: Date | null;
  lastAlbaranAt: Date | null;
  lastFacturaPath: string | null;
  lastFacturaPeriod: Date | null;
  lastFacturaAt: Date | null;
};

function storedPointer(order: PointerFields, kind: DocKind): Pointer | null {
  const keys = pointerKeys(kind);
  const relPath = order[keys.path];
  return relPath ? { relPath, period: order[keys.period], at: order[keys.at] } : null;
}

// Last monthly document of this kind for the order. A missing or stale pointer
// is refreshed by searching the folder for the order number; a new year's order
// with nothing yet falls back to the previous order of the same resource, so
// the document format carries over.
async function lastDocument(order: Order, kind: DocKind): Promise<Pointer | null> {
  const stored = storedPointer(order, kind);
  if (stored && (await exists(path.join(docsRoot(), stored.relPath)))) return stored;

  const found = await findLatest(order.orderNumber, kind);
  if (found) {
    const keys = pointerKeys(kind);
    await prisma.emailOrder.update({
      where: { id: order.id },
      data: { [keys.path]: found.relPath, [keys.period]: found.period, [keys.at]: null },
    });
    return { ...found, at: null };
  }

  const previous = await prisma.emailOrder.findMany({
    where: { contractResourceId: order.contractResourceId, id: { not: order.id } },
    omit: { pdfAttachment: true, rawContent: true },
    orderBy: [{ orderDate: "desc" }, { receivedAt: "desc" }],
  });
  for (const p of previous) {
    const pointer = storedPointer(p, kind);
    if (pointer && (await exists(path.join(docsRoot(), pointer.relPath)))) return { ...pointer, period: null, at: null };
  }
  return null;
}

async function summarize(relPath: string, kind: DocKind) {
  const fields = extractFields(documentXml(await fs.readFile(path.join(docsRoot(), relPath))), kind);
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

const samePeriod = (a: Date | null, b: Date) =>
  !!a && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

async function describe(order: Order, kind: DocKind, period: Date) {
  const doc = await lastDocument(order, kind);
  if (!doc) return null;
  const at = doc.at ?? (await fs.stat(path.join(docsRoot(), doc.relPath))).mtime;
  return {
    filename: path.basename(doc.relPath, ".docx"),
    period: doc.period,
    at,
    summary: samePeriod(doc.period, period) ? await summarize(doc.relPath, kind) : null,
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
            if (!linked) return { id: resource.id, name: resource.name, order: null };
            const order = await getOrder(linked.id);
            return {
              id: resource.id,
              name: resource.name,
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                albaran: await describe(order, "albaran", period),
                factura: await describe(order, "factura", period),
              },
            };
          }),
      ),
    })),
  );
}

async function loadSource(order: Order, kind: DocKind) {
  const doc = await lastDocument(order, kind);
  if (!doc) {
    throw new ApiError(404, `No hay ningún ${kind === "albaran" ? "albarán" : "factura"} anterior de este recurso`);
  }
  const docx = await fs.readFile(path.join(docsRoot(), doc.relPath));
  const xml = documentXml(docx);
  return { docx, xml, fields: extractFields(xml, kind), filename: path.basename(doc.relPath, ".docx") };
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
  zip.file("word/document.xml", applyReplacements(xml, replacements));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function previewPdf(orderId: string, kind: DocKind, body: DraftBody) {
  return docxToPdf(await render(await getOrder(orderId), kind, body));
}

export async function existingPdf(orderId: string, kind: DocKind) {
  const doc = storedPointer(await getOrder(orderId), kind);
  if (!doc) throw new ApiError(404, "No hay documento generado");
  const pdfPath = path.join(docsRoot(), doc.relPath.replace(/\.docx$/i, ".pdf"));
  if (!(await exists(pdfPath))) throw new ApiError(404, "No se encontró el PDF de este documento");
  return fs.readFile(pdfPath);
}

// Two people generating the same number at the same instant would collide;
// the exists check turns that into a 409 instead of an overwrite.
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

  const keys = pointerKeys(kind);
  await prisma.emailOrder.update({
    where: { id: order.id },
    data: { [keys.path]: path.relative(docsRoot(), docxPath), [keys.period]: period, [keys.at]: new Date() },
  });

  return { filename };
}
