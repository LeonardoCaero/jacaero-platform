export type DocKind = "albaran" | "factura";

export type Field = { paragraph: number; value: string };

export type DocFields = {
  number: Field;
  date: Field;
  month: string;
  conceptLines: Field[];
  amounts: Field[];
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const PARAGRAPH = /<w:p[ >](?:(?!<w:p[ >])[\s\S])*?<\/w:p>/g;
const TEXT_RUN = /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g;
const DATE = /\d{1,2} de [a-záéíóú]+\s+(?:de\s+)?\d{4}/i;
const AMOUNT = /\d{1,3}(?:\.\d{3})+,\d{2} ?€|\d+,\d{2} ?€/g;

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function paragraphTexts(xml: string): string[] {
  return [...xml.matchAll(PARAGRAPH)].map((p) => [...p[0].matchAll(TEXT_RUN)].map((t) => decode(t[2])).join(""));
}

export function monthIndex(name: string) {
  return MONTHS.indexOf(name.toLowerCase());
}

export function monthName(index: number) {
  return MONTHS[index];
}

export function extractFields(xml: string, kind: DocKind): DocFields {
  const texts = paragraphTexts(xml);
  const find = (test: (t: string, i: number) => boolean) => texts.findIndex(test);

  let number: Field | undefined;
  if (kind === "factura") {
    const i = find((t) => /FACTURA Nº\s*\d+/.test(t));
    if (i >= 0) number = { paragraph: i, value: texts[i].match(/FACTURA Nº\s*(\d+)/)![1] };
  } else {
    const label = find((t) => /^Nº albar[aá]n$/i.test(t.trim()));
    const i = find((t, j) => j > label && /^\d+$/.test(t.trim()));
    if (label >= 0 && i >= 0) number = { paragraph: i, value: texts[i].trim() };
  }
  if (!number) throw new Error("No se encontró el número del documento");

  const dateIdx = find((t) => DATE.test(t));
  if (dateIdx < 0) throw new Error("No se encontró la fecha del documento");
  const date = { paragraph: dateIdx, value: texts[dateIdx].match(DATE)![0] };

  const month = texts.map((t) => t.match(/MES DE ([A-ZÁÉÍÓÚ]+)/)?.[1]).find(Boolean)?.toLowerCase();
  if (!month || monthIndex(month) < 0) throw new Error("No se encontró el mes del documento");

  const conceptLines = texts
    .map((t, paragraph) => ({ paragraph, value: t.trim() }))
    .filter((f) => f.paragraph !== dateIdx && f.paragraph !== number!.paragraph)
    .filter((f) => f.value.toLowerCase().includes(month));

  const amounts = texts.flatMap((t, paragraph) =>
    [...t.matchAll(AMOUNT)].map((m) => ({ paragraph, value: m[0] })),
  );
  if (amounts.length < 3) throw new Error("No se encontraron los importes del documento");

  return { number, date, month, conceptLines, amounts: amounts.slice(0, 3) };
}

function replaceInParagraph(para: string, from: string, to: string): string {
  const runs = [...para.matchAll(TEXT_RUN)].map((m) => ({ index: m.index!, match: m, text: decode(m[2]) }));
  const full = runs.map((r) => r.text).join("");
  const start = full.indexOf(from);
  if (start < 0) throw new Error(`No se encontró "${from}" en el documento`);
  const end = start + from.length;

  let offset = 0;
  const newTexts = runs.map((r) => {
    const rStart = offset;
    const rEnd = offset + r.text.length;
    offset = rEnd;
    if (rEnd <= start || rStart >= end) return r.text;
    const before = r.text.slice(0, Math.max(0, start - rStart));
    const after = r.text.slice(Math.max(0, end - rStart));
    return before + (rStart <= start ? to : "") + after;
  });

  let out = "";
  let last = 0;
  runs.forEach((r, i) => {
    out += para.slice(last, r.index);
    const open = newTexts[i] === r.text ? r.match[1] : '<w:t xml:space="preserve">';
    out += open + encode(newTexts[i]) + r.match[3];
    last = r.index + r.match[0].length;
  });
  return out + para.slice(last);
}

export type Replacement = { paragraph: number; from: string; to: string };

function keepPaddedWidth(para: string, delta: number): string {
  if (delta === 0) return para;
  const text = [...para.matchAll(TEXT_RUN)].map((m) => decode(m[2])).join("");
  const padding = text.match(/ {8,}/g)?.sort((a, b) => b.length - a.length)[0];
  if (!padding) return para;
  const width = delta > 0 ? Math.max(1, padding.length - delta * 2) : padding.length + Math.floor(-delta * 1.5);
  return replaceInParagraph(para, padding, " ".repeat(width));
}

export function applyReplacements(xml: string, replacements: Replacement[]): string {
  let i = -1;
  return xml.replace(PARAGRAPH, (para) => {
    i++;
    const own = replacements.filter((r) => r.paragraph === i);
    const delta = own.reduce((sum, r) => sum + r.to.length - r.from.length, 0);
    return own.reduce((p, r) => replaceInParagraph(p, r.from, r.to), keepPaddedWidth(para, delta));
  });
}

export function parseAmount(value: string) {
  return Number(value.replace(/[€\s.]/g, "").replace(",", "."));
}

export function formatAmount(n: number, like: string) {
  const [int, dec] = n.toFixed(2).split(".");
  const grouped = like.includes(".") ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : int;
  return `${grouped},${dec}${like.includes(" €") ? " €" : "€"}`;
}

export function formatDateEs(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function withMonth(text: string, from: string, to: string) {
  return text
    .replace(new RegExp(from.toUpperCase(), "g"), to.toUpperCase())
    .replace(new RegExp(from, "gi"), to);
}
