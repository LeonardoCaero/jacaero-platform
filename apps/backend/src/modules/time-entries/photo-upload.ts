import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { env } from "../../config/env.js";

export const photosDir = path.resolve(env.UPLOADS_PATH, "time-entries");
fs.mkdirSync(photosDir, { recursive: true });

export const uploadPhotos = multer({
  storage: multer.diskStorage({
    destination: photosDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});
