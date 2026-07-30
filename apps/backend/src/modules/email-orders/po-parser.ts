// Regex-based, not LLM — this client's PO PDFs are a fixed SAP-generated template
// (validated against real samples). Only add other parsers here if a sender's format actually differs.

function esNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  return Number(raw.replace(/\./g, "").replace(",", "."));
}

function esDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const [d, m, y] = raw.split(".").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export type ParsedLine = {
  lineNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  deliveryDate?: Date;
};

export type ParsedPurchaseOrder = {
  orderNumber?: string;
  orderDate?: Date;
  vat?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  quoteRef?: string;
  notes?: string;
  lines: ParsedLine[];
  totalAmount?: number;
};

export function parsePurchaseOrderText(fullText: string): ParsedPurchaseOrder {
  // page 1 has all the order data; pages 2+ are repeated boilerplate/legal terms
  const page1 = fullText.split(/\n--\s*1 of \d+\s*--\n/)[0];

  const field = (re: RegExp) => page1.match(re)?.[1]?.trim();

  const orderNumber = field(/N° Pedido\s+(\d+)/);
  const orderDate = esDate(field(/Fecha:\s+(\d{2}\.\d{2}\.\d{4})/));
  const vat = field(/Nº VAT\s+(\S+)/);

  const [, contactName, contactEmail, contactPhone] =
    page1.match(/Persona de contacto\n(.+)\n(\S+@\S+)\n(\+?\d[\d\s]+)/) ?? [];

  const deliveryAddress = field(/Dirección de entrega:\n([\s\S]+?)\nNº VAT/)
    ?.split("\n")
    .join(", ");

  const quoteRef = field(/(?:Nº presupuesto:|Según presupuesto)\s*:?\s*(\d+)/);
  const notes = field(/Facturar a:\n\S+@\S+\n([\s\S]+?)\nLínea\n/);

  const lineItemRe =
    /\n(\d+)\n(.+?)\n([\d.,]+)\s*\t([\d.,]+)\t([\d.,]+)\s*\/1\t\S+\s*\t\S+\nFecha de\nentrega:\s*(\d{2}\.\d{2}\.\d{4})/g;
  const lines: ParsedLine[] = [...page1.matchAll(lineItemRe)].map((m) => ({
    lineNumber: m[1],
    description: m[2].trim(),
    quantity: esNumber(m[3])!,
    unitPrice: esNumber(m[4])!,
    amount: esNumber(m[5])!,
    deliveryDate: esDate(m[6]),
  }));

  const totalAmount = esNumber(field(/Precio Total\s*\n\(IVA no\s*\nincluido\)\s*\nEUR\s*\n([\d.,]+)/));

  return {
    orderNumber,
    orderDate,
    vat,
    contactName,
    contactEmail,
    contactPhone,
    deliveryAddress,
    quoteRef,
    notes: notes?.trim(),
    lines,
    totalAmount,
  };
}
