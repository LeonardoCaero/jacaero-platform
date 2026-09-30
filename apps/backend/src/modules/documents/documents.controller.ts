import fs from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import PizZip from "pizzip";
import { categorySchema, listDocumentsSchema, getDocumentFileSchema } from "./documents.schema.js";
import {
  listCategory,
  getCategoryFile,
  getCategoryFolderPath,
  type DocCategory,
  type DocFile,
} from "../../common/services/nas-documents.service.js";
import { clientFromDocx } from "../recurring-albaranes/docx-fields.js";
import { extractPdfText } from "../email-orders/email-orders.service.js";
import { extractDocumentTotal } from "../email-orders/po-parser.js";
import { prisma } from "../../db/prisma.js";

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

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const fileCache = new Map<string, { mtimeMs: number; value: unknown }>();

async function cachedRead<T>(fullPath: string, read: (buffer: Buffer) => Promise<T>): Promise<T> {
  const { mtimeMs } = await fs.stat(fullPath);
  const cached = fileCache.get(fullPath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.value as T;
  const value = await read(await fs.readFile(fullPath));
  fileCache.set(fullPath, { mtimeMs, value });
  return value;
}

async function quoteDetails(files: DocFile[], year: number) {
  const folder = await getCategoryFolderPath(year, "presupuesto").catch(() => null);
  const clients = new Map<string, string>();
  const totals = new Map<string, number | undefined>();
  if (!folder) return { clients, totals };

  const repeated = new Set(
    files.map((f) => f.number).filter((n, i, all) => all.indexOf(n) !== i),
  );

  for (const f of files) {
    if (f.hasDocx) {
      const client = await cachedRead(path.join(folder, `${f.name}.docx`), async (buffer) =>
        clientFromDocx(new PizZip(buffer).file("word/document.xml")?.asText() ?? ""),
      ).catch(() => null);
      if (client) clients.set(f.name, client);
    }
    if (f.hasPdf && repeated.has(f.number)) {
      const total = await cachedRead(path.join(folder, `${f.name}.pdf`), async (buffer) =>
        extractDocumentTotal(await extractPdfText(buffer)),
      ).catch(() => undefined);
      totals.set(f.name, total);
    }
  }
  return { clients, totals };
}

async function withQuoteStatus(files: DocFile[], year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [orders, sent, details] = await Promise.all([
    prisma.emailOrder.findMany({
      where: {
        quoteRef: { not: null },
        orderNumber: { not: null },
        OR: [
          { orderDate: { gte: yearStart, lt: yearEnd } },
          { orderDate: null, receivedAt: { gte: yearStart, lt: yearEnd } },
        ],
      },
      select: { quoteRef: true, orderNumber: true, totalAmount: true, senderEmail: true },
    }),
    prisma.presupuestoSent.findMany({ where: { year } }),
    quoteDetails(files, year).catch(() => ({ clients: new Map<string, string>(), totals: new Map<string, number | undefined>() })),
  ]);

  const sameNumber = (number: string) => files.filter((f) => f.number === number);

  const ordersFor = (f: DocFile) => {
    const candidates = sameNumber(f.number);
    return orders
      .filter((o) => Number(o.quoteRef!.replace(/\D/g, "")) === Number(f.number))
      .filter((o) => {
        if (candidates.length === 1) return true;
        const amount = o.totalAmount == null ? null : Number(o.totalAmount);
        const byAmount = candidates.filter((c) => {
          const total = details.totals.get(c.name);
          return amount != null && total != null && Math.abs(total - amount) < 0.01;
        });
        if (byAmount.length === 1) return byAmount[0].name === f.name;
        const company = normalize(o.senderEmail.split("@")[1]?.split(".")[0] ?? "");
        const byClient = candidates.filter((c) => company && normalize(details.clients.get(c.name) ?? "").includes(company));
        return byClient.length !== 1 || byClient[0].name === f.name;
      })
      .map((o) => o.orderNumber!);
  };

  const sentFor = (f: DocFile) => {
    const exact = sent.find((s) => normalize(s.name) === normalize(f.name));
    if (exact) return exact;
    if (sameNumber(f.number).length > 1) return undefined;
    return sent
      .filter((s) => s.number === Number(f.number))
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())[0];
  };

  return files.map((f) => {
    const sentDoc = sentFor(f);
    return {
      ...f,
      orderNumbers: ordersFor(f),
      sent: sentDoc ? { at: sentDoc.sentAt, to: sentDoc.recipients, viaClient: sentDoc.viaClient } : null,
      client: details.clients.get(f.name) ?? null,
    };
  });
}

export async function getFileHandler(req: Request<{ category: string }>, res: Response) {
  const { category } = categorySchema.parse(req.params);
  const { year, number, ext, name } = getDocumentFileSchema.parse(req.query);

  const filePath = await getCategoryFile(category as DocCategory, year, number, ext, name);
  const buffer = await fs.readFile(filePath);
  res.setHeader("Content-Type", CONTENT_TYPES[ext]);
  res.send(buffer);
}
