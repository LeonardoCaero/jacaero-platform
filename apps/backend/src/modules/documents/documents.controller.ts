import fs from "node:fs/promises";
import type { Request, Response } from "express";
import { categorySchema, listDocumentsSchema, getDocumentFileSchema } from "./documents.schema.js";
import { listCategory, getCategoryFile, type DocCategory } from "../../common/services/nas-documents.service.js";
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

async function withQuoteStatus(files: DocFile[], year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [orders, sent] = await Promise.all([
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
  ]);

  return files.map((f) => {
    const number = Number(f.number);
    const sentDoc = sent.find((s) => s.number === number);
    return {
      ...f,
      orderNumbers: orders.filter((o) => Number(o.quoteRef!.replace(/\D/g, "")) === number).map((o) => o.orderNumber!),
      sent: sentDoc ? { at: sentDoc.sentAt, to: sentDoc.recipients } : null,
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
