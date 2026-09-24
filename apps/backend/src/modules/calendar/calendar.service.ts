import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { userHasPermission } from "../../common/middlewares/require-permission.middleware.js";
import type { calendarEventSchema } from "./calendar.schema.js";
import { visibilityFilter } from "./calendar.visibility.js";
import { photosDir } from "./photo-upload.js";
import type { z } from "zod";

type Input = z.infer<typeof calendarEventSchema>;

const include = { assignees: { include: { user: { select: { id: true, fullName: true } } } } } as const;
type EventWithAssignees = Prisma.CalendarEventGetPayload<{ include: typeof include }>;

// Admins (CALENDAR:MANAGE) can also edit every note, not just see it.
const isAdmin = (userId: string) => userHasPermission(userId, "CALENDAR:MANAGE");

async function serialize(events: EventWithAssignees[], requesterId: string) {
  const admin = await isAdmin(requesterId);
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(events.map((e) => e.createdBy))] } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.fullName]));

  return events.map(({ assignees, ...e }) => ({
    ...e,
    authorName: nameById.get(e.createdBy) ?? "",
    sharedWith: assignees.map((a) => a.user),
    canEdit: admin || e.createdBy === requesterId,
  }));
}

export async function list(requesterId: string, from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  const overlaps: Prisma.CalendarEventWhereInput = {
    date: { lt: end },
    OR: [{ endDate: null, date: { gte: start } }, { endDate: { gte: start } }],
  };
  const events = await prisma.calendarEvent.findMany({
    where: { AND: [overlaps, visibilityFilter(requesterId, await isAdmin(requesterId))] },
    include,
    orderBy: { date: "asc" },
  });
  return serialize(events, requesterId);
}

function toData(input: Input, authorId: string) {
  const sharedWith = input.visibility === "COMPANY" ? [] : [...new Set(input.sharedWith)].filter((id) => id !== authorId);
  return {
    title: input.title,
    description: input.description || null,
    date: input.date,
    endDate: input.endDate ?? null,
    color: input.color ?? null,
    visibility: input.visibility,
    assignees: { create: sharedWith.map((userId) => ({ userId })) },
  };
}

export async function create(requesterId: string, input: Input) {
  const event = await prisma.calendarEvent.create({
    data: { ...toData(input, requesterId), createdBy: requesterId },
    include,
  });
  return (await serialize([event], requesterId))[0];
}

async function findEditable(id: string, requesterId: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (event && (event.createdBy === requesterId || (await isAdmin(requesterId)))) return event;
  throw new ApiError(404, "Event not found");
}

export async function update(id: string, requesterId: string, input: Input) {
  const existing = await findEditable(id, requesterId);
  const data = toData(input, existing.createdBy);
  const event = await prisma.calendarEvent.update({
    where: { id },
    data: { ...data, assignees: { deleteMany: {}, ...data.assignees } },
    include,
  });
  return (await serialize([event], requesterId))[0];
}

export async function remove(id: string, requesterId: string) {
  const event = await findEditable(id, requesterId);
  await prisma.calendarEvent.delete({ where: { id } });
  await Promise.all(event.photos.map((filename) => fs.unlink(path.join(photosDir, filename)).catch(() => {})));
}

export async function addPhotos(id: string, requesterId: string, files: Express.Multer.File[]) {
  await findEditable(id, requesterId);
  const event = await prisma.calendarEvent.update({
    where: { id },
    data: { photos: { push: files.map((f) => f.filename) } },
    include,
  });
  return (await serialize([event], requesterId))[0];
}

// Anyone who can see the note can see its photos.
export async function getPhotoPath(id: string, requesterId: string, filename: string) {
  const event = await prisma.calendarEvent.findFirst({
    where: { AND: [{ id }, visibilityFilter(requesterId, await isAdmin(requesterId))] },
  });
  if (!event || !event.photos.includes(filename)) throw new ApiError(404, "Photo not found");
  return path.join(photosDir, filename);
}

export async function removePhoto(id: string, requesterId: string, filename: string) {
  const event = await findEditable(id, requesterId);
  if (!event.photos.includes(filename)) throw new ApiError(404, "Photo not found");
  await prisma.calendarEvent.update({ where: { id }, data: { photos: event.photos.filter((p) => p !== filename) } });
  await fs.unlink(path.join(photosDir, filename)).catch(() => {});
}

// Minimal directory so anyone can pick who to share a note with (GET /users needs USERS:MANAGE).
export function people() {
  return prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
