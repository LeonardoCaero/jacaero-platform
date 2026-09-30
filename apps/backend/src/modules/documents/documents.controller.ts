import fs from "node:fs/promises";
import type { Request, Response } from "express";
import { categorySchema, listDocumentsSchema, getDocumentFileSchema } from "./documents.schema.js";
import path from "node:path";
import PizZip from "pizzip";
import {
  listCategory,
  getCategoryFile,
  getCategoryFolderPath,
  type DocCategory,
} from "../../common/services/nas-documents.service.js";
import { clientFromDocx } from "../recurring-albaranes/docx-fields.js";
import { prisma } from "../../db/prisma.js";
import type { DocFile } from "../../common/services/nas-documents.service.js";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function listHandler(req: Request<{ category: string }>, res: Response) {
  const { category } = categorySchema.parse(req.params);
  const { year } = listDocumentsSchema.parse(req.query);
  const files = await listCategory(category as DocCategory, year);
  res.json(category === "presupuesto" ? await withQuoteStatus(files, year) : files);
}

const clientCache = new Map<string, { mtimeMs: number; client: string | null }>();

async function quoteClients(year: number) {
  const folder = await getCategoryFolderPath(year, "presupuesto").catch(() => null);
  const clients = new Map<number, string>();
  if (!folder) return clients;

  for (const name of await fs.readdir(folder)) {
    const number = name.match(/^(\d+)\s.*\.docx$/i)?.[1];
    if (!number) continue;
    const fullPath = path.join(folder, name);
    const { mtimeMs } = await fs.stat(fullPath);
    let cached = clientCache.get(fullPath);
    if (!cached || cached.mtimeMs !== mtimeMs) {
      const xml = new PizZip(await fs.readFile(fullPath)).file("word/document.xml")?.asText() ?? "";
      cached = { mtimeMs, client: clientFromDocx(xml) };
      clientCache.set(fullPath, cached);
    }
    if (cached.client) clients.set(Number(number), cached.client);
  }
  return clients;
}

async function withQuoteStatus(files: DocFile[], year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [orders, sent, clients] = await Promise.all([
    prisma.emailOrder.findMany({
      where: {
        quoteRef: { not: null },
        orderNumber: { not: null },
        OR: [
          { orderDate: { gte: yearStart, lt: yearEnd } },
          { orderDate: null, receivedAt: { gte: yearStart, lt: yearEnd } },
        ],
      },
      select: { quoteRef: true, orderNumber: true },
    }),
    prisma.presupuestoSent.findMany({ where: { year } }),
    quoteClients(year).catch(() => new Map<number, string>()),
  ]);

  return files.map((f) => {
    const number = Number(f.number);
    const sentDoc = sent.find((s) => s.number === number);
    return {
      ...f,
      orderNumbers: orders.filter((o) => Number(o.quoteRef!.replace(/\D/g, "")) === number).map((o) => o.orderNumber!),
      sent: sentDoc ? { at: sentDoc.sentAt, to: sentDoc.recipients } : null,
      client: clients.get(number) ?? null,
    };
  });
}

export async function getFileHandler(req: Request<{ category: string }>, res: Response) {
  const { category } = categorySchema.parse(req.params);
  const { year, number, ext } = getDocumentFileSchema.parse(req.query);

  const filePath = await getCategoryFile(category as DocCategory, year, number, ext);
  const buffer = await fs.readFile(filePath);
  res.setHeader("Content-Type", CONTENT_TYPES[ext]);
  res.send(buffer);
}
