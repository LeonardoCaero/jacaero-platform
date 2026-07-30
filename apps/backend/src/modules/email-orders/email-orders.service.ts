import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PDFParse } from "pdf-parse";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { env } from "../../config/env.js";
import { parsePurchaseOrderText } from "./po-parser.js";
import { findQuoteFile } from "./documents.service.js";

function allowedSenders() {
  return (env.ORDERS_SENDER_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  await parser.destroy();
  return text;
}

export async function syncOrders() {
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
  });

  const created: string[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for (const from of senders) {
        for await (const msg of client.fetch({ seen: false, from }, { source: true, uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const pdf = parsed.attachments.find((a) => a.contentType === "application/pdf");

          if (pdf) {
            const text = await extractPdfText(pdf.content);
            const po = parsePurchaseOrderText(text);
            const year = (po.orderDate ?? new Date()).getUTCFullYear();
            const quoteFile = po.quoteRef ? await findQuoteFile(year, po.quoteRef) : undefined;

            const order = await prisma.emailOrder.create({
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
                quotedAt: quoteFile ? new Date() : undefined,
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
            created.push(order.id);
          }

          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { created: created.length };
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

type MilestoneField = "quotedAt" | "deliveryNoteAt" | "invoicedAt";

export async function setMilestone(id: string, field: MilestoneField, done: boolean) {
  await get(id);
  return prisma.emailOrder.update({ where: { id }, data: { [field]: done ? new Date() : null } });
}
