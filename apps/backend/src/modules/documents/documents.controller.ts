import fs from "node:fs/promises";
import type { Request, Response } from "express";
import { categorySchema, listDocumentsSchema, getDocumentFileSchema } from "./documents.schema.js";
import { listCategory, getCategoryFile, type DocCategory } from "../../common/services/nas-documents.service.js";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function listHandler(req: Request<{ category: string }>, res: Response) {
  const { category } = categorySchema.parse(req.params);
  const { year } = listDocumentsSchema.parse(req.query);
  res.json(await listCategory(category as DocCategory, year));
}

export async function getFileHandler(req: Request<{ category: string }>, res: Response) {
  const { category } = categorySchema.parse(req.params);
  const { year, number, ext } = getDocumentFileSchema.parse(req.query);

  const filePath = await getCategoryFile(category as DocCategory, year, number, ext);
  const buffer = await fs.readFile(filePath);
  res.setHeader("Content-Type", CONTENT_TYPES[ext]);
  res.send(buffer);
}
