import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { userHasPermission } from "../../common/middlewares/require-permission.middleware.js";
import type { createTimeEntrySchema, updateTimeEntrySchema } from "./time-entries.schema.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof createTimeEntrySchema>;
type UpdateInput = z.infer<typeof updateTimeEntrySchema>;

export async function list(requesterId: string, month: string, targetUserId?: string) {
  if (targetUserId && targetUserId !== requesterId && !(await userHasPermission(requesterId, "TIME:VIEW_ALL"))) {
    throw new ApiError(403, "Forbidden");
  }
  const userId = targetUserId ?? requesterId;

  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return prisma.timeEntry.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
}

export async function teamSummary(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const entries = await prisma.timeEntry.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true, hours: true, userId: true, user: { select: { fullName: true } } },
  });

  const byUser = new Map<string, { userId: string; fullName: string; hours: number }>();
  const byDay = new Map<string, number>();

  for (const entry of entries) {
    const hours = Number(entry.hours);
    const dayKey = entry.date.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + hours);

    const existing = byUser.get(entry.userId);
    if (existing) existing.hours += hours;
    else byUser.set(entry.userId, { userId: entry.userId, fullName: entry.user.fullName, hours });
  }

  return {
    byUser: [...byUser.values()].sort((a, b) => b.hours - a.hours),
    byDay: Object.fromEntries(byDay),
  };
}

export async function create(userId: string, data: CreateInput) {
  return prisma.timeEntry.create({
    data: { userId, createdBy: userId, ...data, description: data.description || null },
  });
}

export async function teamDayEntries(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const entries = await prisma.timeEntry.findMany({
    where: { date: { gte: start, lt: end } },
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return entries.map(({ user, ...entry }) => ({ ...entry, fullName: user.fullName }));
}

async function findAccessible(id: string, requesterId: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new ApiError(404, "Time entry not found");
  if (entry.userId === requesterId || (await userHasPermission(requesterId, "TIME:EDIT_ALL"))) {
    return entry;
  }
  throw new ApiError(404, "Time entry not found");
}

export async function update(id: string, requesterId: string, data: UpdateInput) {
  await findAccessible(id, requesterId);
  return prisma.timeEntry.update({
    where: { id },
    data: { ...data, description: data.description === undefined ? undefined : data.description || null },
  });
}

export async function remove(id: string, requesterId: string) {
  await findAccessible(id, requesterId);
  await prisma.timeEntry.delete({ where: { id } });
}
