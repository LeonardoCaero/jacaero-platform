import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { ApiError } from "../errors/api-error.js";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing access token");
  }

  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  next();
}
