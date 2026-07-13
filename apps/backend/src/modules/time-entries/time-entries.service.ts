import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { createTimeEntrySchema, updateTimeEntrySchema } from "./time-entries.schema.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof createTimeEntrySchema>;
type UpdateInput = z.infer<typeof updateTimeEntrySchema>;

export async function list(userId: string, month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return prisma.timeEntry.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
}

export async function create(userId: string, data: CreateInput) {
  return prisma.timeEntry.create({
    data: { userId, createdBy: userId, ...data, description: data.description || null },
  });
}

async function findOwned(id: string, userId: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) {
    throw new ApiError(404, "Time entry not found");
  }
  return entry;
}

export async function update(id: string, userId: string, data: UpdateInput) {
  await findOwned(id, userId);
  return prisma.timeEntry.update({
    where: { id },
    data: { ...data, description: data.description === undefined ? undefined : data.description || null },
  });
}

export async function remove(id: string, userId: string) {
  await findOwned(id, userId);
  await prisma.timeEntry.delete({ where: { id } });
}
