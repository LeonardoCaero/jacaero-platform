import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../errors/api-error.js";

export async function userHasPermission(userId: string, key: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  return user?.role?.permissions.some((rp) => rp.permission.key === key) ?? false;
}

export function requirePermission(key: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    if (!(await userHasPermission(req.user.userId, key))) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  };
}
