import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { env } from "../../config/env.js";

// Images stored on disk under UPLOADS_PATH/<subdir>, served only through authenticated endpoints.
export function photoUpload(subdir: string) {
  const dir = path.resolve(env.UPLOADS_PATH, subdir);
  fs.mkdirSync(dir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 6 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  });

  return { dir, upload };
}
