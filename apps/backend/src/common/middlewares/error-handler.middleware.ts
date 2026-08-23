import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../errors/api-error.js";
import { logger } from "../services/logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", details: err.issues });
    return;
  }

  logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
}
