import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../errors/api-error.js";

export function requirePermission(key: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const hasPermission = user?.role?.permissions.some((rp) => rp.permission.key === key) ?? false;

    if (!hasPermission) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  };
}
