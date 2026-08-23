import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { updateUserSchema } from "./users.schema.js";
import type { z } from "zod";

type UpdateInput = z.infer<typeof updateUserSchema>;

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  jobTitle: true,
  status: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
} as const;

export async function list() {
  return prisma.user.findMany({ select: userSelect, orderBy: { fullName: "asc" } });
}

export async function update(id: string, actorUserId: string, data: UpdateInput) {
  if (id === actorUserId && data.status === "INACTIVE") {
    throw new ApiError(400, "You cannot deactivate your own account");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, "User not found");
  }

  return prisma.user.update({ where: { id }, data, select: userSelect });
}
