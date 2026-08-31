import fs from "node:fs/promises";
import type { QuoteCategory } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PDFParse } from "pdf-parse";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { env } from "../../config/env.js";
import { logger } from "../../common/services/logger.js";
import { notifyPermission } from "../push-subscriptions/push-subscriptions.service.js";
import { parsePurchaseOrderText, extractOrderNumber, extractDocumentTotal, extractDeclaredNumber } from "./po-parser.js";
import { listCategory, getCategoryFile, type DocCategory } from "../../common/services/nas-documents.service.js";

function allowedSenders() {
  return (env.ORDERS_SENDER_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  await parser.destroy();
  return text;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms)),
  ]);
}

export async function syncOrders(options: { full?: boolean } = {}) {
  return withTimeout(syncOrdersInner(options), options.full ? 600_000 : 120_000, "email sync");
}

// Keeps one IMAP connection open with IDLE instead of polling: the server pushes an 'exists'
// event the instant new mail lands, so orders show up right away with no setInterval anywhere.
export function startImapIdleListener() {
  if (!env.ORDERS_EMAIL_ADDRESS || !env.ORDERS_EMAIL_APP_PASSWORD) return;
  runIdleLoop();
}

async function runIdleLoop() {
  for (;;) {
    try {
      await idleUntilDisconnected();
    } catch (err) {
      logger.error("[email-orders] IMAP idle connection lost:", (err as Error).message);
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

function idleUntilDisconnected(): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new ImapFlow({
      host: env.ORDERS_IMAP_HOST,
      port: 993,
      secure: true,
      auth: { user: env.ORDERS_EMAIL_ADDRESS!, pass: env.ORDERS_EMAIL_APP_PASSWORD! },
      logger: false,
      // Gmail drops IDLE around the 29min mark; ImapFlow breaks and restarts it on its own
      // before that so the session never times out from under us.
      maxIdleTime: 25 * 60 * 1000,
    });

    let syncTimer: NodeJS.Timeout | undefined;
    const scheduleSync = () => {
      clearTimeout(syncTimer);
      // Coalesce a burst of new messages (e.g. several POs at once) into a single sync.
      syncTimer = setTimeout(() => {
        syncOrders().catch((err) => logger.error("[email-orders] sync after new mail failed:", err));
      }, 2_000);
    };

    client.on("exists", scheduleSync);
    client.on("close", () => resolve());
    client.on("error", (err) => reject(err));

    client
      .connect()
      .then(() => client.getMailboxLock("INBOX"))
      .then(() => logger.info("[email-orders] IMAP idle listener connected"))
      .catch(reject);
  });
}

async function syncOrdersInner(options: { full?: boolean } = {}) {
  if (!env.ORDERS_EMAIL_ADDRESS || !env.ORDERS_EMAIL_APP_PASSWORD) {
    throw new ApiError(400, "ORDERS_EMAIL_ADDRESS / ORDERS_EMAIL_APP_PASSWORD not configured");
  }
  const senders = allowedSenders();
  if (senders.length === 0) {
    throw new ApiError(400, "ORDERS_SENDER_ALLOWLIST not configured");
  }

  const client = new ImapFlow({
    host: env.ORDERS_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: env.ORDERS_EMAIL_ADDRESS, pass: env.ORDERS_EMAIL_APP_PASSWORD },
    logger: false,
    greetingTimeout: 15_000,
    connectionTimeout: 15_000,
  });
  // ImapFlow emits 'error' on socket/protocol issues (e.g. our own socketTimeout above) — with
  // no listener, Node treats that as an uncaught exception and kills the whole process.
  client.on("error", (err) => logger.error("[email-orders] IMAP client error:", err.message));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  const since = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const searchCriteria = options.full ? { since } : { seen: false as const };

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Drain the fetch stream fully before issuing any other IMAP command (flags, etc). ImapFlow
      // deadlocks if you call another client method while still iterating a fetch() response —
      // this is what was silently hanging the sync and eventually tripping the socket timeout.
      const messages: { uid: number; source: Buffer; from: string }[] = [];
      for (const from of senders) {
        for await (const msg of client.fetch({ ...searchCriteria, from }, { source: true, uid: true })) {
          if (msg.source) messages.push({ uid: msg.uid, source: msg.source, from });
        }
      }

      const seenUids: number[] = [];
      for (const msg of messages) {
        try {
          const wasCreated = await withTimeout(processMessage(msg.source, msg.from), 20_000, "message processing");
          if (wasCreated) created++;
          else skipped++;
          seenUids.push(msg.uid);
        } catch (err) {
          failed++;
          logger.error(`[email-orders] failed processing uid ${msg.uid}:`, (err as Error).message);
        }
      }

      if (seenUids.length > 0) {
        await client.messageFlagsAdd({ uid: seenUids.join(",") }, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  if (created > 0) {
    const plural = created === 1 ? "" : "s";
    await notifyPermission("ORDERS:MANAGE", {
      title: "Nuevo pedido recibido",
      body: `${created} pedido${plural} nuevo${plural} capturado${plural} por email.`,
    }).catch((err) => logger.error("[email-orders] failed to send push notification:", (err as Error).message));
  }

  return { created, skipped, failed };
}

async function processMessage(source: Buffer, from: string): Promise<boolean> {
  const parsed = await simpleParser(source);
  const pdf = parsed.attachments.find((a) => a.contentType === "application/pdf");
  if (!pdf) return false;

  const text = await extractPdfText(pdf.content);
  const po = parsePurchaseOrderText(text);

  const existing = po.orderNumber
    ? await prisma.emailOrder.findFirst({ where: { orderNumber: po.orderNumber } })
    : null;
  if (existing) return false;

  await prisma.emailOrder.create({
    data: {
      orderNumber: po.orderNumber,
      quoteRef: po.quoteRef,
      orderDate: po.orderDate,
      subject: parsed.subject ?? "(sin asunto)",
      senderEmail: from,
      contactName: po.contactName,
      contactEmail: po.contactEmail,
      contactPhone: po.contactPhone,
      deliveryAddress: po.deliveryAddress,
      notes: po.notes,
      totalAmount: po.totalAmount,
      rawContent: text,
      pdfAttachment: new Uint8Array(pdf.content),
      receivedAt: parsed.date ?? new Date(),
      lines: {
        create: po.lines.map((l) => ({
          lineNumber: l.lineNumber,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          deliveryDate: l.deliveryDate,
        })),
      },
    },
  });
  return true;
}

async function linkCategory(
  category: "albaran" | "factura",
  year: number,
  pending: { id: string; orderNumber: string | null }[],
  milestoneField: "deliveryNoteAt" | "invoicedAt",
  numberField: "albaranNumber" | "facturaNumber",
) {
  const remaining = [...pending];
  let linked = 0;
  if (remaining.length === 0) return linked;

  const files = await listCategory(category, year);
  for (const f of files) {
    if (remaining.length === 0) break;
    if (!f.hasPdf) continue;

    try {
      const filePath = await getCategoryFile(category, year, f.number, "pdf");
      const buffer = await fs.readFile(filePath);
      const text = await extractPdfText(buffer);
      const orderNumber = extractOrderNumber(text);
      const matchIndex = orderNumber ? remaining.findIndex((o) => o.orderNumber === orderNumber) : -1;
      if (matchIndex !== -1) {
        const [order] = remaining.splice(matchIndex, 1);
        await prisma.emailOrder.update({
          where: { id: order.id },
          data: { [milestoneField]: new Date(), [numberField]: f.number },
        });
        linked++;
      }
    } catch (err) {
      logger.error(`[email-orders] failed reading ${category} ${f.number}:`, (err as Error).message);
    }
  }
  return linked;
}

const ORIGIN_CATEGORIES = ["presupuesto", "pedidoMaterial", "horasTrabajo"] as const satisfies DocCategory[];

const DOC_TO_QUOTE_CATEGORY = {
  presupuesto: "PRESUPUESTO",
  horasTrabajo: "HORAS",
  pedidoMaterial: "MATERIAL",
} as const satisfies Record<(typeof ORIGIN_CATEGORIES)[number], QuoteCategory>;

type OriginDoc = {
  category: (typeof ORIGIN_CATEGORIES)[number];
  filePath: string;
  filenameNumber: string;
  declaredNumber?: string;
  total?: number;
};

// The NAS filename number can drift from the document's own declared "Nº presupuesto/pedido"
// number (confirmed on a real file: saved as "020 ...pdf" on disk, but its own header reads
// "Nº presupuesto 021") — indexed by both so a lookup by either still resolves the file.
async function buildOriginIndex(year: number): Promise<OriginDoc[]> {
  const index: OriginDoc[] = [];
  for (const category of ORIGIN_CATEGORIES) {
    const files = await listCategory(category, year);
    for (const f of files) {
      if (!f.hasPdf) continue;
      try {
        const filePath = await getCategoryFile(category, year, f.number, "pdf");
        const text = await extractPdfText(await fs.readFile(filePath));
        index.push({
          category,
          filePath,
          filenameNumber: f.number.padStart(3, "0"),
          declaredNumber: extractDeclaredNumber(category, text),
          total: extractDocumentTotal(text),
        });
      } catch (err) {
        logger.error(`[email-orders] failed reading ${category} ${f.number}:`, (err as Error).message);
      }
    }
  }
  return index;
}

function resolveOriginDocument(index: OriginDoc[], year: number, ref: string, expectedAmount: number | null) {
  const padded = ref.padStart(3, "0");
  const candidates = index.filter((d) => d.filenameNumber === padded || d.declaredNumber === padded);
  if (candidates.length === 0) return undefined;

  // A single candidate by number is trusted as-is — the reference number is always entered
  // correctly, but the amount often isn't a match: a presupuesto can be an umbrella quote
  // fulfilled across several orders, or a horasTrabajo document can list a full month while
  // the order only covers the overtime hours the client picked out of it. The amount check
  // below exists only to disambiguate when multiple documents share the same number.
  if (candidates.length === 1) return candidates[0];

  if (expectedAmount == null) return undefined;

  const matches = candidates.filter((c) => c.total != null && Math.abs(c.total - expectedAmount) < 0.01);
  if (matches.length !== 1) {
    logger.error(
      `[email-orders] could not resolve origin document for ref ${ref} (${year}): ${candidates.length} candidate(s), ${matches.length} by amount ${expectedAmount}`,
    );
    return undefined;
  }
  return matches[0];
}

export async function reconcileDocuments(year: number) {
  return withTimeout(reconcileDocumentsInner(year), 180_000, "document reconciliation");
}

async function reconcileDocumentsInner(year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const pendingQuote = await prisma.emailOrder.findMany({
    where: { orderDate: { gte: yearStart, lt: yearEnd }, quotedAt: null, quoteRef: { not: null } },
    select: { id: true, quoteRef: true, totalAmount: true },
  });
  let quoteLinked = 0;
  if (pendingQuote.length > 0) {
    const originIndex = await buildOriginIndex(year);
    for (const order of pendingQuote) {
      const expectedAmount = order.totalAmount != null ? Number(order.totalAmount) : null;
      const found = resolveOriginDocument(originIndex, year, order.quoteRef!, expectedAmount);
      if (found) {
        await prisma.emailOrder.update({
          where: { id: order.id },
          data: { quotedAt: new Date(), quoteCategory: DOC_TO_QUOTE_CATEGORY[found.category] },
        });
        quoteLinked++;
      }
    }
  }

  const pendingAlbaran = await prisma.emailOrder.findMany({
    where: { orderDate: { gte: yearStart, lt: yearEnd }, deliveryNoteAt: null, orderNumber: { not: null } },
    select: { id: true, orderNumber: true },
  });
  const albaranLinked = await linkCategory("albaran", year, pendingAlbaran, "deliveryNoteAt", "albaranNumber");

  const pendingFactura = await prisma.emailOrder.findMany({
    where: { orderDate: { gte: yearStart, lt: yearEnd }, invoicedAt: null, orderNumber: { not: null } },
    select: { id: true, orderNumber: true },
  });
  const facturaLinked = await linkCategory("factura", year, pendingFactura, "invoicedAt", "facturaNumber");

  return { quoteLinked, albaranLinked, facturaLinked };
}

export async function list() {
  return prisma.emailOrder.findMany({
    omit: { pdfAttachment: true, rawContent: true },
    include: { lines: true, client: { select: { id: true, name: true } } },
    orderBy: { receivedAt: "desc" },
  });
}

export async function get(id: string) {
  const order = await prisma.emailOrder.findUnique({
    where: { id },
    omit: { pdfAttachment: true },
    include: { lines: true, client: { select: { id: true, name: true } } },
  });
  if (!order) throw new ApiError(404, "Email order not found");
  return order;
}

export async function getPdf(id: string) {
  const order = await prisma.emailOrder.findUnique({ where: { id }, select: { pdfAttachment: true } });
  if (!order?.pdfAttachment) throw new ApiError(404, "PDF not found for this order");
  return order.pdfAttachment;
}

type MilestoneField = "deliveryNoteAt" | "invoicedAt";

export async function setMilestone(id: string, field: MilestoneField, done: boolean) {
  await get(id);
  return prisma.emailOrder.update({ where: { id }, data: { [field]: done ? new Date() : null } });
}

const UI_TO_QUOTE_CATEGORY = {
  presupuesto: "PRESUPUESTO",
  horas: "HORAS",
  material: "MATERIAL",
} as const satisfies Record<string, QuoteCategory>;

export async function setQuoteStatus(id: string, category: "pending" | "presupuesto" | "horas" | "material") {
  await get(id);
  return prisma.emailOrder.update({
    where: { id },
    data: {
      quotedAt: category === "pending" ? null : new Date(),
      quoteCategory: category === "pending" ? null : UI_TO_QUOTE_CATEGORY[category],
    },
  });
}

export async function setFavorite(id: string, favorite: boolean) {
  await get(id);
  return prisma.emailOrder.update({ where: { id }, data: { favorite } });
}

const DOC_CATEGORY_TO_QUOTE_CATEGORY = {
  presupuesto: "PRESUPUESTO",
  horasTrabajo: "HORAS",
  pedidoMaterial: "MATERIAL",
} as const satisfies Partial<Record<DocCategory, QuoteCategory>>;

export async function linkDocument(id: string, category: DocCategory, number: string) {
  await get(id);

  if (category === "albaran") {
    return prisma.emailOrder.update({ where: { id }, data: { deliveryNoteAt: new Date(), albaranNumber: number } });
  }
  if (category === "factura") {
    return prisma.emailOrder.update({ where: { id }, data: { invoicedAt: new Date(), facturaNumber: number } });
  }
  return prisma.emailOrder.update({
    where: { id },
    data: { quotedAt: new Date(), quoteCategory: DOC_CATEGORY_TO_QUOTE_CATEGORY[category] },
  });
}
