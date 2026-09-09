import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { prisma } from "../../db/prisma.js";
import { getCategoryFolderPath, nextDocumentNumber } from "../../common/services/nas-documents.service.js";
import { ApiError } from "../../common/errors/api-error.js";

const execFileAsync = promisify(execFile);

function monthNames(period: Date) {
  const mes = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(period);
  return { mes, mesMayus: mes.toUpperCase() };
}

function todayEs() {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

function fillTemplate(templateDocx: Buffer, data: Record<string, string>): Buffer {
  const zip = new PizZip(templateDocx);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

// ponytail: shells out to LibreOffice (installed in the backend image) instead of
// pulling in a PDF-rendering library — it's the standard free way to turn a real
// docx into a real PDF and needs no Node-side layout engine.
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

async function getTemplate(id: string) {
  const template = await prisma.recurringAlbaranTemplate.findUnique({ where: { id }, include: { client: true } });
  if (!template) throw new ApiError(404, "Plantilla no encontrada");
  return template;
}

async function renderDocx(templateId: string, period: Date) {
  const template = await getTemplate(templateId);
  const { mes, mesMayus } = monthNames(period);
  const { number } = await nextDocumentNumber(period.getUTCFullYear(), "albaran");
  const title = template.titleTemplate.replace("{MES_MAYUS}", mesMayus);
  const filename = `${number} ${title}`;

  const docx = fillTemplate(Buffer.from(template.templateDocx), {
    FECHA: todayEs(),
    ALBARAN_NUM: number,
    MES: mes,
    MES_MAYUS: mesMayus,
  });

  return { number, filename, docx };
}

export async function list() {
  const templates = await prisma.recurringAlbaranTemplate.findMany({
    include: { client: true },
    orderBy: { createdAt: "asc" },
  });

  return templates.map((t) => ({
    id: t.id,
    clientName: t.client.name,
    orderNumber: t.orderNumber,
    label: t.label,
    lastPeriod: t.lastPeriod,
    lastNumber: t.lastNumber,
  }));
}

export async function previewPdf(templateId: string, period: Date) {
  const { docx } = await renderDocx(templateId, period);
  return docxToPdf(docx);
}

// ponytail: next number is recomputed from what's on disk at confirm time, so two
// people confirming at the same instant could grab the same number — fine for a
// single-admin tool, add a lock if this ever gets used by more than one person at once.
export async function confirm(templateId: string, period: Date) {
  const { number, filename, docx } = await renderDocx(templateId, period);
  const pdf = await docxToPdf(docx);

  const folder = await getCategoryFolderPath(period.getUTCFullYear(), "albaran");
  const docxPath = path.join(folder, `${filename}.docx`);
  const pdfPath = path.join(folder, `${filename}.pdf`);

  const alreadyExists = await fs
    .access(docxPath)
    .then(() => true)
    .catch(() => false);
  if (alreadyExists) {
    throw new ApiError(409, `Ya existe un archivo con el número ${number}, refresca e inténtalo de nuevo`);
  }

  await fs.writeFile(docxPath, docx);
  await fs.writeFile(pdfPath, pdf);

  await prisma.recurringAlbaranTemplate.update({
    where: { id: templateId },
    data: { lastPeriod: period, lastNumber: number },
  });

  return { number, filename };
}
