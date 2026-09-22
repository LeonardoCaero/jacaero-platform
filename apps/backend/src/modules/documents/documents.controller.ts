import fs from "node:fs/promises";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { categorySchema, listDocumentsSchema, getDocumentFileSchema, shareTokenQuerySchema } from "./documents.schema.js";
import { listCategory, getCategoryFile, type DocCategory } from "../../common/services/nas-documents.service.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../common/errors/api-error.js";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type ShareTokenPayload = { category: DocCategory; year: number; number: string; ext: "pdf" | "docx" };

// ponytail: share links ride the same JWT_SECRET as access tokens, just a longer-lived, narrowly-scoped token
const SHARE_TOKEN_TTL = "30d";

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

export async function createShareHandler(req: Request<{ category: string }>, res: Response) {
  const { category } = categorySchema.parse(req.params);
  const { year, number, ext } = getDocumentFileSchema.parse(req.query);

  await getCategoryFile(category as DocCategory, year, number, ext); // 404s if it doesn't exist

  const payload: ShareTokenPayload = { category: category as DocCategory, year, number, ext };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: SHARE_TOKEN_TTL });
  res.json({ token });
}

export async function getSharedFileHandler(req: Request, res: Response) {
  const { token } = shareTokenQuerySchema.parse(req.query);

  let payload: ShareTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as ShareTokenPayload;
  } catch {
    throw new ApiError(401, "Enlace no válido o caducado");
  }

  const filePath = await getCategoryFile(payload.category, payload.year, payload.number, payload.ext);
  const buffer = await fs.readFile(filePath);
  res.setHeader("Content-Type", CONTENT_TYPES[payload.ext]);
  res.send(buffer);
}
