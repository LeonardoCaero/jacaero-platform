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

export async function remove(id: string, actorUserId: string) {
  if (id === actorUserId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, "User not found");
  }

  // Full removal: every table with a userId FK must be cleared first, or the User delete
  // fails on the FK constraint. Wrapped in a transaction so a failure part-way through
  // doesn't leave the user half-deleted.
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.employeeProfile.deleteMany({ where: { userId: id } }),
    prisma.timeEntry.deleteMany({ where: { userId: id } }),
    prisma.note.deleteMany({ where: { userId: id } }),
    prisma.calendarEventAssignee.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
}
