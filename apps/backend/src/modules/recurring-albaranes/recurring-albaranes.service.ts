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

async function getTemplate(id: string) {
  const template = await prisma.recurringAlbaranTemplate.findUnique({ where: { id } });
  if (!template) throw new ApiError(404, "Pedido recurrente no encontrado");
  return template;
}

type Template = Awaited<ReturnType<typeof getTemplate>>;

// Resolves the last monthly document of this kind, refreshing the stored
// pointer if it's missing or points to a file that no longer exists.
async function lastDocument(template: Template, kind: DocKind) {
  const keys = pointerKeys(kind);
  const stored = template[keys.path];
  if (stored && (await exists(path.join(docsRoot(), stored)))) {
    return { relPath: stored, period: template[keys.period], at: template[keys.at] };
  }

  const found = await findLatest(template.orderNumber, kind);
  if (!found) return null;
  await prisma.recurringAlbaranTemplate.update({
    where: { id: template.id },
    data: { [keys.path]: found.relPath, [keys.period]: found.period, [keys.at]: null },
  });
  return { ...found, at: null };
}

async function describe(template: Template, kind: DocKind) {
  const doc = await lastDocument(template, kind);
  if (!doc) return null;
  const fullPath = path.join(docsRoot(), doc.relPath);
  const at = doc.at ?? (await fs.stat(fullPath)).mtime;
  return { filename: path.basename(doc.relPath, ".docx"), period: doc.period, at };
}

export async function list() {
  const templates = await prisma.recurringAlbaranTemplate.findMany({
    include: { client: true },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    templates.map(async (t) => ({
      id: t.id,
      clientName: t.client.name,
      orderNumber: t.orderNumber,
      label: t.label,
      albaran: await describe(t, "albaran"),
      factura: await describe(t, "factura"),
    })),
  );
}

export async function clients() {
  return prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function create(data: { clientId: string; orderNumber: string; label: string }) {
  const taken = await prisma.recurringAlbaranTemplate.findUnique({ where: { orderNumber: data.orderNumber } });
  if (taken) throw new ApiError(409, "Ese pedido ya está en la lista");
  return prisma.recurringAlbaranTemplate.create({ data });
}

export async function remove(id: string) {
  await getTemplate(id);
  await prisma.recurringAlbaranTemplate.delete({ where: { id } });
}

async function loadSource(templateId: string, kind: DocKind) {
  const template = await getTemplate(templateId);
  const doc = await lastDocument(template, kind);
  if (!doc) throw new ApiError(404, `No hay ningún ${kind === "albaran" ? "albarán" : "factura"} anterior de este pedido`);
  const docx = await fs.readFile(path.join(docsRoot(), doc.relPath));
  const xml = documentXml(docx);
  return { docx, xml, fields: extractFields(xml, kind), filename: path.basename(doc.relPath, ".docx") };
}

export async function draft(templateId: string, kind: DocKind, period: Date) {
  const { fields, filename } = await loadSource(templateId, kind);
  const month = monthName(period.getUTCMonth());
  const { number } = await nextDocumentNumber(period.getUTCFullYear(), kind);

  return {
    number,
    date: new Date().toISOString().slice(0, 10),
    conceptLines: fields.conceptLines.map((c) => withMonth(c.value, fields.month, month)),
    baseAmount: parseAmount(fields.amounts[0].value),
    title: withMonth(filename.replace(/^\d+\s*/, ""), fields.month, month),
  };
}

async function render(templateId: string, kind: DocKind, body: DraftBody) {
  const { docx, xml, fields } = await loadSource(templateId, kind);
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

export async function previewPdf(templateId: string, kind: DocKind, body: DraftBody) {
  return docxToPdf(await render(templateId, kind, body));
}

export async function generate(templateId: string, kind: DocKind, period: Date, body: DraftBody) {
  const docx = await render(templateId, kind, body);
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
  await prisma.recurringAlbaranTemplate.update({
    where: { id: templateId },
    data: { [keys.path]: path.relative(docsRoot(), docxPath), [keys.period]: period, [keys.at]: new Date() },
  });

  return { filename };
}
