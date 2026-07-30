import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) => s.normalize("NFD").replace(diacritics, "").toLowerCase();

// Folder names vary between year archives ("Presupuestos" vs "PRESUPUESTOS",
// "Albaran" vs "ALBARÁN") — match by normalized prefix instead of assuming an exact name.
async function findFolder(yearPath: string, keyword: string) {
  const entries = await fs.readdir(yearPath, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && normalize(e.name).startsWith(normalize(keyword)));
  return match ? path.join(yearPath, match.name) : undefined;
}

function docNumber(fileName: string) {
  return fileName.match(/^(\d+)\s/)?.[1];
}

export async function findQuoteFile(year: number, quoteRef: string) {
  if (!env.DOCS_ROOT_PATH) return undefined;
  const yearPath = path.join(env.DOCS_ROOT_PATH, String(year));
  const folder = await findFolder(yearPath, "presupuesto");
  if (!folder) return undefined;

  const padded = quoteRef.padStart(3, "0");
  const files = await fs.readdir(folder);
  const match = files.find((f) => docNumber(f) === padded && f.toLowerCase().endsWith(".pdf"));
  return match ? path.join(folder, match) : undefined;
}

export type DocType = "albaran" | "factura";

export async function nextDocumentNumber(year: number, type: DocType) {
  if (!env.DOCS_ROOT_PATH) throw new Error("DOCS_ROOT_PATH is not configured");
  const yearPath = path.join(env.DOCS_ROOT_PATH, String(year));
  const folder = await findFolder(yearPath, type === "albaran" ? "albaran" : "factura");
  if (!folder) throw new Error(`No se encontró la carpeta de ${type} para ${year}`);

  const files = await fs.readdir(folder);
  const max = files.reduce((max, f) => Math.max(max, Number(docNumber(f) ?? 0)), 0);

  return { number: String(max + 1).padStart(3, "0"), date: new Date() };
}
