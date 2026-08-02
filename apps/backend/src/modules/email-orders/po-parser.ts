export function extractOrderNumber(text: string): string | undefined {
  return text.match(/N[ºo°]\s*de\s*pedido:?\s*(\d+)/i)?.[1];
}

// Confirmed on a real file: saved as "020 ...pdf" on disk, but its own header reads
// "Nº presupuesto 021" — the filename and the document's own declared number can disagree.
export function extractDeclaredNumber(
  category: "presupuesto" | "pedidoMaterial" | "horasTrabajo",
  text: string,
): string | undefined {
  const pattern =
    category === "presupuesto"
      ? /N[ºo°]\s*presupuesto\s+(\d+)/i
      : category === "pedidoMaterial"
        ? /N[ºo°]\s*pedido\s+(\d+)/i
        : /Fecha:[\s\S]{0,60}?N[ºo°]\s*(\d+)/i;
  return text.match(pattern)?.[1]?.padStart(3, "0");
}

// Confirmed on a real 2-page document with two "TOTAL SIN IVA" sections (2089€ + 902€) whose
// order cites the sum, 2991€ — the real total can be split across more than one section.
export function extractDocumentTotal(text: string): number | undefined {
  const horas = text.match(/Total horas.*?\(([\d.,]+)\s*€\)/i)?.[1];
  if (horas) return esNumber(horas);

  const sectionRe = /(?:TOTAL SIN IVA|MATERIAL Y MANO DE OBRA)[.\s…]*((?:[\d.,]+\s*€\s*\n?)+)/gi;
  const sectionTotals = [...text.matchAll(sectionRe)]
    .map((m) => [...m[1].matchAll(/[\d.,]+(?=\s*€)/g)].at(-1)?.[0])
    .map(esNumber)
    .filter((n): n is number => n != null);

  if (sectionTotals.length === 0) return undefined;
  return sectionTotals.reduce((sum, n) => sum + n, 0);
}

export function esNumber(raw?: string): number | undefined {
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
  const page1 = fullText.split(/\n--\s*1 of \d+\s*--\n/)[0];

  const field = (re: RegExp) => page1.match(re)?.[1]?.trim();

  const orderNumber = field(/N° Pedido\s+(\d+)/);
  // Day/month aren't always zero-padded (confirmed on a real order: "12.3.2026", not "12.03.2026").
  const orderDate = esDate(field(/Fecha:\s+(\d{1,2}\.\d{1,2}\.\d{4})/));
  const vat = field(/Nº VAT\s+(\S+)/);

  const [, contactName, contactEmail, contactPhone] =
    page1.match(/Persona de contacto\n(.+)\n(\S+@\S+)\n(\+?[\d ]+)/) ?? [];

  const deliveryAddress = field(/Dirección de entrega:\n([\s\S]+?)\nNº VAT/)
    ?.split("\n")
    .join(", ");

  const notes = field(/Facturar a:\n\S+@\S+\n([\s\S]+?)\nLínea\n/);
  const quoteRef =
    field(
      /(?:N[ºo°]\s*(?:de\s*)?(?:presupuesto|oferta)|Según\s*(?:presupuesto|prespuesto|oferta|referencia|ref\.?)|OFERTA)\s*(?:n[ºo°]\s*)?:?\s*(\d+)/i,
    ) ?? notes?.match(/[Aa]djunta\s+(\d+)\s/)?.[1];

  const lineItemRe =
    /\n(\d+)\n(.+?)\n([\d.,]+)\s*\t([\d.,]+)\t([\d.,]+)\s*\/1\t\S+\s*\t\S+\nFecha de\nentrega:\s*(\d{1,2}\.\d{1,2}\.\d{4})/g;
  // pdf-parse extracts these two numbers as [Importe, Precio] regardless of the table's visual
  // header order (confirmed against a real order where quantity != 1, so the two values differ).
  //
  // Searches fullText, not page1: on a real 6-segment order, the whole line-item table and total
  // landed past the first "-- 1 of N --" marker and were silently missed.
  const lines: ParsedLine[] = [...fullText.matchAll(lineItemRe)].map((m) => ({
    lineNumber: m[1],
    description: m[2].trim(),
    quantity: esNumber(m[3])!,
    amount: esNumber(m[4])!,
    unitPrice: esNumber(m[5])!,
    deliveryDate: esDate(m[6]),
  }));

  const totalAmount = esNumber(fullText.match(/Precio Total\s*\n\(IVA no\s*\nincluido\)\s*\nEUR\s*\n([\d.,]+)/)?.[1]);

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
