import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { logger } from "./logger.js";

const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) => s.normalize("NFD").replace(diacritics, "").toLowerCase();

const FS_TIMEOUT_MS = 5000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timed out reaching DOCS_ROOT_PATH")), ms)),
  ]);
}

async function findFolder(yearPath: string, keyword: string) {
  const entries = await fs.readdir(yearPath, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && normalize(e.name).startsWith(normalize(keyword)));
  return match ? path.join(yearPath, match.name) : undefined;
}

function docNumber(fileName: string) {
  return fileName.match(/^(\d+)\s/)?.[1];
}

export type DocType = "albaran" | "factura";

async function lookupNextDocumentNumber(yearPath: string, type: DocType) {
  const folder = await findFolder(yearPath, type === "albaran" ? "albaran" : "factura");
  if (!folder) throw new Error(`No se encontró la carpeta de ${type} para ${yearPath}`);

  const files = await fs.readdir(folder);
  const max = files.reduce((max, f) => Math.max(max, Number(docNumber(f) ?? 0)), 0);

  return { number: String(max + 1).padStart(3, "0"), date: new Date() };
}

export async function nextDocumentNumber(year: number, type: DocType) {
  if (!env.DOCS_ROOT_PATH) throw new Error("DOCS_ROOT_PATH is not configured");
  const yearPath = path.join(env.DOCS_ROOT_PATH, String(year));
  return withTimeout(lookupNextDocumentNumber(yearPath, type), FS_TIMEOUT_MS);
}

export type DocCategory = "presupuesto" | "albaran" | "factura" | "pedidoMaterial" | "horasTrabajo";

const CATEGORY_KEYWORDS: Record<DocCategory, string> = {
  presupuesto: "presupuesto",
  albaran: "albaran",
  factura: "factura",
  pedidoMaterial: "pedidos",
  horasTrabajo: "horas",
};

export async function getCategoryFolderPath(year: number, category: DocCategory) {
  if (!env.DOCS_ROOT_PATH) throw new Error("DOCS_ROOT_PATH is not configured");
  const yearPath = path.join(env.DOCS_ROOT_PATH, String(year));
  const folder = await withTimeout(findFolder(yearPath, CATEGORY_KEYWORDS[category]), FS_TIMEOUT_MS);
  if (!folder) throw new Error(`No se encontró la carpeta de ${category} para ${yearPath}`);
  return folder;
}

export type DocFile = {
  number: string;
  name: string;
  title: string;
  hasPdf: boolean;
  hasDocx: boolean;
};

async function lookupCategory(yearPath: string, category: DocCategory): Promise<DocFile[]> {
  const folder = await findFolder(yearPath, CATEGORY_KEYWORDS[category]);
  if (!folder) return [];

  const files = await fs.readdir(folder);
  const byName = new Map<string, DocFile>();

  for (const f of files) {
    const number = docNumber(f);
    const ext = path.extname(f).toLowerCase();
    if (!number || (ext !== ".pdf" && ext !== ".docx")) continue;

    const name = f.slice(0, -ext.length);
    const title = name.replace(/^\d+\s*/, "");
    const entry = byName.get(name) ?? { number, name, title, hasPdf: false, hasDocx: false };
    if (ext === ".pdf") entry.hasPdf = true;
    if (ext === ".docx") entry.hasDocx = true;
    byName.set(name, entry);
  }

  return [...byName.values()].sort((a, b) => Number(b.number) - Number(a.number) || a.name.localeCompare(b.name));
}

export async function listCategory(category: DocCategory, year: number): Promise<DocFile[]> {
  if (!env.DOCS_ROOT_PATH) return [];
  const yearPath = path.join(env.DOCS_ROOT_PATH, String(year));

  try {
    return await withTimeout(lookupCategory(yearPath, category), FS_TIMEOUT_MS);
  } catch (err) {
    logger.error("[documents] could not reach DOCS_ROOT_PATH:", (err as Error).message);
    return [];
  }
}

async function lookupCategoryFile(
  yearPath: string,
  category: DocCategory,
  number: string,
  ext: "pdf" | "docx",
  name?: string,
) {
  const folder = await findFolder(yearPath, CATEGORY_KEYWORDS[category]);
  if (!folder) throw new Error("Category folder not found");

  const padded = number.padStart(3, "0");
  const files = await fs.readdir(folder);
  const match = name
    ? files.find((f) => f.toLowerCase() === `${name}.${ext}`.toLowerCase())
    : files.find((f) => docNumber(f) === padded && f.toLowerCase().endsWith(`.${ext}`));
  if (!match) throw new Error("File not found");
  return path.join(folder, match);
}

export async function getCategoryFile(
  category: DocCategory,
  year: number,
  number: string,
  ext: "pdf" | "docx",
  name?: string,
) {
  if (!env.DOCS_ROOT_PATH) throw new Error("DOCS_ROOT_PATH is not configured");
  const yearPath = path.join(env.DOCS_ROOT_PATH, String(year));
  return withTimeout(lookupCategoryFile(yearPath, category, number, ext, name), FS_TIMEOUT_MS);
}

