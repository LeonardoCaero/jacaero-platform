import fs from "node:fs/promises";
import type { QuoteCategory } from "@prisma/client";
import { ImapFlow, type MessageStructureObject } from "imapflow";
import { simpleParser } from "mailparser";
import { PDFParse } from "pdf-parse";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { env } from "../../config/env.js";
import { logger } from "../../common/services/logger.js";
import { notifyPermission } from "../push-subscriptions/push-subscriptions.service.js";
import { parsePurchaseOrderText, extractOrderNumber, extractDocumentTotal, extractDeclaredNumber, documentNumberFromFilename, documentFromFilename } from "./po-parser.js";
import { listCategory, getCategoryFile, type DocCategory } from "../../common/services/nas-documents.service.js";

function allowedSenders() {
  return (env.ORDERS_SENDER_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function extractPdfText(buffer: Buffer) {
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

// ImapFlow quotes label names itself — pre-quoting them creates a label with literal quotes.
const FACTURAR_OK_LABEL = "FACTURAR OK";
const FACTURA_LABEL = "Factura";
const ALBARAN_LABEL = "Albarán";
const FACTURAR_OK_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

function attachmentNames(node: MessageStructureObject): string[] {
  const name = node.dispositionParameters?.filename ?? node.parameters?.name;
  return [...(name ? [name] : []), ...(node.childNodes ?? []).flatMap(attachmentNames)];
}

export async function syncFacturarOk() {
  if (!env.ORDERS_EMAIL_ADDRESS || !env.ORDERS_EMAIL_APP_PASSWORD) return;
  return withTimeout(syncFacturarOkInner(), 120_000, "FACTURAR OK labels");
}

// Albaranes go out from this same mailbox as attachments named "<number> ALBARÁN ...", so the
// Sent folder tells us when each one was sent. Two days after that, if there's still no factura,
// the order's email gets the Gmail label FACTURAR OK. Once the factura is linked, it swaps
// Albarán / FACTURAR OK for Factura.
export async function recordSentDocuments(client: ImapFlow, allPath: string) {
  const own = env.ORDERS_EMAIL_ADDRESS!.toLowerCase();
  const domainOf = (address: string) => address.toLowerCase().split("@")[1] ?? "";
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  // Only quotes were tracked before; the first run with every category backfills the whole year.
  const tracksAll = await prisma.documentSent.findFirst({ where: { category: { not: "presupuesto" } }, select: { id: true } });
  const last = tracksAll
    ? await prisma.documentSent.findFirst({ orderBy: { sentAt: "desc" }, select: { sentAt: true } })
    : null;
  const since = last ? new Date(last.sentAt.getTime() - 24 * 60 * 60 * 1000) : yearStart;

  type Found = {
    category: string;
    year: number;
    number: number;
    name: string;
    sentAt: Date;
    recipients: string;
    viaClient: boolean;
    from: string;
  };
  const found: Found[] = [];
  const lock = await client.getMailboxLock(allPath);
  try {
    const uids = await client.search(
      { since, gmraw: 'has:attachment (presupuesto OR albaran OR albarán OR factura OR horas OR "pedido material")' },
      { uid: true },
    );
    if (uids && uids.length > 0) {
      for await (const msg of client.fetch(uids, { envelope: true, bodyStructure: true }, { uid: true })) {
        const date = msg.envelope?.date;
        const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        if (!date || !msg.bodyStructure || !from) continue;
        const recipients = (msg.envelope?.to ?? []).map((a) => a.address).filter(Boolean).join(", ");
        for (const name of attachmentNames(msg.bodyStructure)) {
          const doc = documentFromFilename(name);
          if (!doc) continue;
          const fileName = name.replace(/\.[^.]+$/, "");
          found.push({
            ...doc,
            year: date.getFullYear(),
            name: fileName,
            sentAt: date,
            recipients,
            viaClient: from !== own,
            from,
          });
        }
      }
    }
  } finally {
    lock.release();
  }

  const previous = await prisma.documentSent.findMany({ where: { viaClient: false }, select: { recipients: true } });
  const clientDomains = new Set(
    [...previous.map((p) => p.recipients), ...found.filter((f) => !f.viaClient).map((f) => f.recipients)]
      .flatMap((r) => r.split(","))
      .map((a) => domainOf(a.trim()))
      .filter((d) => d && d !== domainOf(own)),
  );

  for (const { from, ...sent } of found) {
    if (sent.viaClient && !clientDomains.has(domainOf(from))) continue;
    const data = sent.viaClient ? { ...sent, recipients: "" } : sent;
    const existing = await prisma.documentSent.findUnique({
      where: { category_year_name: { category: sent.category, year: sent.year, name: sent.name } },
    });
    if (!existing) await prisma.documentSent.create({ data });
    else if (sent.sentAt < existing.sentAt) await prisma.documentSent.update({ where: { id: existing.id }, data });
  }
}

async function syncFacturarOkInner() {
  const needsSentDate = await prisma.emailOrder.findMany({
    where: { albaranNumber: { not: null }, albaranSentAt: null },
    select: { id: true, albaranNumber: true, receivedAt: true },
  });

  const client = new ImapFlow({
    host: env.ORDERS_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: env.ORDERS_EMAIL_ADDRESS!, pass: env.ORDERS_EMAIL_APP_PASSWORD! },
    logger: false,
    greetingTimeout: 15_000,
    connectionTimeout: 15_000,
  });
  client.on("error", (err) => logger.error("[email-orders] IMAP client error:", err.message));

  await client.connect();
  try {
    const boxes = await client.list();
    const sentPath = boxes.find((b) => b.specialUse === "\\Sent")?.path;
    const allPath = boxes.find((b) => b.specialUse === "\\All")?.path;
    if (!sentPath || !allPath) throw new Error("Gmail Sent / All Mail folders not found");

    await recordSentDocuments(client, allPath);

    if (needsSentDate.length > 0) {
      const since = new Date(Math.min(...needsSentDate.map((o) => o.receivedAt.getTime())));
      const sentDates = new Map<number, Date[]>();
      const lock = await client.getMailboxLock(sentPath);
      try {
        const uids = await client.search({ since, gmraw: "has:attachment (albaran OR albarán)" }, { uid: true });
        if (uids && uids.length > 0) {
          for await (const msg of client.fetch(uids, { envelope: true, bodyStructure: true }, { uid: true })) {
            const date = msg.envelope?.date;
            if (!date || !msg.bodyStructure) continue;
            for (const name of attachmentNames(msg.bodyStructure)) {
              const number = documentNumberFromFilename(name, "albaran");
              if (number !== undefined) sentDates.set(number, [...(sentDates.get(number) ?? []), date]);
            }
          }
        }
      } finally {
        lock.release();
      }

      for (const order of needsSentDate) {
        // Numbers restart every year, so only count sends after the order arrived.
        const dates = (sentDates.get(Number(order.albaranNumber)) ?? []).filter((d) => d >= order.receivedAt);
        if (dates.length === 0) continue;
        const sentAt = new Date(Math.min(...dates.map((d) => d.getTime())));
        await prisma.emailOrder.update({ where: { id: order.id }, data: { albaranSentAt: sentAt } });
      }
    }

    const toLabel = await prisma.emailOrder.findMany({
      where: {
        albaranSentAt: { lte: new Date(Date.now() - FACTURAR_OK_DELAY_MS) },
        invoicedAt: null,
        facturarOkAt: null,
        orderNumber: { not: null },
      },
      select: { id: true, orderNumber: true, senderEmail: true },
    });
    const toInvoice = await prisma.emailOrder.findMany({
      where: { invoicedAt: { not: null }, facturaLabelAt: null, orderNumber: { not: null } },
      select: { id: true, orderNumber: true, senderEmail: true },
    });
    if (toLabel.length === 0 && toInvoice.length === 0) return;

    const lock = await client.getMailboxLock(allPath);
    try {
      const findOrderEmail = async (order: { orderNumber: string | null; senderEmail: string }) => {
        const uids = await client.search(
          { from: order.senderEmail, gmraw: `subject:${order.orderNumber}` },
          { uid: true },
        );
        if (!uids || uids.length === 0) {
          logger.error(`[email-orders] order email not found in Gmail for ${order.orderNumber}`);
          return undefined;
        }
        return uids;
      };

      for (const order of toLabel) {
        const uids = await findOrderEmail(order);
        if (!uids) continue;
        await client.messageFlagsAdd(uids, [FACTURAR_OK_LABEL], { uid: true, useLabels: true });
        await prisma.emailOrder.update({ where: { id: order.id }, data: { facturarOkAt: new Date() } });
      }

      for (const order of toInvoice) {
        const uids = await findOrderEmail(order);
        if (!uids) continue;
        await client.messageFlagsAdd(uids, [FACTURA_LABEL], { uid: true, useLabels: true });
        await client.messageFlagsRemove(uids, [FACTURAR_OK_LABEL, ALBARAN_LABEL], { uid: true, useLabels: true });
        await prisma.emailOrder.update({
          where: { id: order.id },
          data: { facturaLabelAt: new Date(), facturarOkAt: null },
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// Keeps one IMAP connection open with IDLE instead of polling: the server pushes an 'exists'
// event the instant new mail lands, so orders show up right away without polling the mailbox.
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

  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const latest = options.full
    ? null
    : await prisma.emailOrder.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } });
  const since = latest ? new Date(latest.receivedAt.getTime() - 2 * 24 * 60 * 60 * 1000) : yearStart;

  await client.connect();
  try {
    const allPath = (await client.list()).find((b) => b.specialUse === "\\All")?.path;
    if (!allPath) throw new Error("Gmail All Mail folder not found");

    const lock = await client.getMailboxLock(allPath);
    try {
      // Drain the fetch stream fully before issuing any other IMAP command. ImapFlow
      // deadlocks if you call another client method while still iterating a fetch() response.
      const messages: { uid: number; source: Buffer; from: string }[] = [];
      for (const from of senders) {
        const uids = await client.search({ since, from, gmraw: "has:attachment filename:pdf" }, { uid: true });
        if (!uids || uids.length === 0) continue;
        for await (const msg of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
          if (msg.source) messages.push({ uid: msg.uid, source: msg.source, from });
        }
      }

      for (const msg of messages) {
        try {
          const wasCreated = await withTimeout(processMessage(msg.source, msg.from), 20_000, "message processing");
          if (wasCreated) created++;
          else skipped++;
        } catch (err) {
          failed++;
          logger.error(`[email-orders] failed processing uid ${msg.uid}:`, (err as Error).message);
        }
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
  if (!po.orderNumber) return false;

  const existing = await prisma.emailOrder.findFirst({ where: { orderNumber: po.orderNumber } });
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
      const filePath = await getCategoryFile(category, year, f.number, "pdf", f.name);
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
// number (confirmed on a real file: saved as "001 ...pdf" on disk, but its own header reads
// "Nº presupuesto 002") — indexed by both so a lookup by either still resolves the file.
async function buildOriginIndex(year: number): Promise<OriginDoc[]> {
  const index: OriginDoc[] = [];
  for (const category of ORIGIN_CATEGORIES) {
    const files = await listCategory(category, year);
    for (const f of files) {
      if (!f.hasPdf) continue;
      try {
        const filePath = await getCategoryFile(category, year, f.number, "pdf", f.name);
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
    include: {
      lines: true,
      client: { select: { id: true, name: true } },
      contractResource: { select: { id: true, name: true } },
    },
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

const MILESTONE_NUMBER_FIELD = { deliveryNoteAt: "albaranNumber", invoicedAt: "facturaNumber" } as const;

export async function unlinkMilestone(id: string, field: MilestoneField) {
  await get(id);
  return prisma.emailOrder.update({ where: { id }, data: { [field]: null, [MILESTONE_NUMBER_FIELD[field]]: null } });
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

export const orderYear = (order: { orderDate: Date | null; receivedAt: Date }) =>
  (order.orderDate ?? order.receivedAt).getUTCFullYear();

export async function listResources() {
  const resources = await prisma.contractResource.findMany({
    where: { contract: { status: "ACTIVE", client: { status: "ACTIVE" } } },
    include: {
      contract: { select: { client: { select: { id: true, name: true } } } },
      emailOrders: { select: { id: true, orderDate: true, receivedAt: true } },
    },
    orderBy: { name: "asc" },
  });

  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    client: r.contract.client,
    orders: r.emailOrders.map((o) => ({ id: o.id, year: orderYear(o) })),
  }));
}

export async function setResource(id: string, contractResourceId: string | null) {
  const order = await get(id);
  if (!contractResourceId) {
    return prisma.emailOrder.update({ where: { id }, data: { contractResourceId: null } });
  }

  if (!order.orderNumber) throw new ApiError(400, "Este pedido no tiene número de pedido");

  const resource = await prisma.contractResource.findUnique({
    where: { id: contractResourceId },
    include: { contract: true, emailOrders: { select: { id: true, orderDate: true, receivedAt: true } } },
  });
  if (!resource || resource.contract.status !== "ACTIVE") throw new ApiError(404, "Recurso no encontrado");

  const year = orderYear(order);
  if (resource.emailOrders.some((o) => o.id !== id && orderYear(o) === year)) {
    throw new ApiError(409, `Este recurso ya tiene un pedido vinculado para ${year}`);
  }

  return prisma.emailOrder.update({
    where: { id },
    data: { contractResourceId, clientId: resource.contract.clientId },
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

const pdfInfoCache = new Map<string, { mtimeMs: number; orderNumber?: string; total?: number }>();

async function pdfInfo(filePath: string) {
  const { mtimeMs } = await fs.stat(filePath);
  const cached = pdfInfoCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) return cached;
  const text = await extractPdfText(await fs.readFile(filePath));
  const info = { mtimeMs, orderNumber: extractOrderNumber(text), total: extractDocumentTotal(text) };
  pdfInfoCache.set(filePath, info);
  return info;
}

const SUGGESTION_RANK = { order: 0, quote: 1, amount: 2 } as const;

// Documents of a category that look like this order's: its PO number inside the PDF, its quote
// number, or the same total. Ranked in that order so the first one is the likely match.
export async function suggestDocuments(id: string, category: DocCategory) {
  const order = await get(id);
  const year = orderYear(order);
  const amount = order.totalAmount != null ? Number(order.totalAmount) : null;
  const quoteNumber = order.quoteRef ? Number(order.quoteRef.replace(/\D/g, "")) : null;
  const isOrigin = (ORIGIN_CATEGORIES as readonly string[]).includes(category);

  type Candidate = {
    number: string;
    name: string;
    title: string;
    total: number | null;
    poNumber: string | null;
    linkedTo: string | null;
    reason?: keyof typeof SUGGESTION_RANK;
  };
  // Who already holds each albarán / factura number this year, so the picker can warn before re-linking.
  const numberField = category === "albaran" ? "albaranNumber" : category === "factura" ? "facturaNumber" : null;
  const holders = new Map<number, string>();
  if (numberField) {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const others = await prisma.emailOrder.findMany({
      where: {
        id: { not: id },
        [numberField]: { not: null },
        OR: [
          { orderDate: { gte: yearStart, lt: yearEnd } },
          { orderDate: null, receivedAt: { gte: yearStart, lt: yearEnd } },
        ],
      },
      select: { orderNumber: true, albaranNumber: true, facturaNumber: true },
    });
    for (const o of others) holders.set(Number(o[numberField]), o.orderNumber ?? "?");
  }
  const documents: Candidate[] = [];
  for (const f of await listCategory(category, year)) {
    if (!f.hasPdf) continue;
    const doc: Candidate = {
      number: f.number,
      name: f.name,
      title: f.title,
      total: null,
      poNumber: null,
      linkedTo: holders.get(Number(f.number)) ?? null,
    };
    try {
      const info = await pdfInfo(await getCategoryFile(category, year, f.number, "pdf", f.name));
      doc.total = info.total ?? null;
      doc.poNumber = info.orderNumber ?? null;
      doc.reason =
        isOrigin && quoteNumber && Number(f.number) === quoteNumber
          ? "quote"
          : order.orderNumber && info.orderNumber === order.orderNumber
            ? "order"
            : amount != null && info.total != null && Math.abs(info.total - amount) < 0.01
              ? "amount"
              : undefined;
    } catch (err) {
      logger.error(`[email-orders] failed reading ${category} ${f.number}:`, (err as Error).message);
    }
    documents.push(doc);
  }
  const suggestions = documents
    .filter((d) => d.reason && !d.linkedTo)
    .sort((a, b) => SUGGESTION_RANK[a.reason!] - SUGGESTION_RANK[b.reason!])
    .slice(0, 5);
  return { suggestions, documents };
}

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
