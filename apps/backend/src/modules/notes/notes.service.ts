import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";

export async function list(category: string, year: number, docName: string) {
  return prisma.documentNote.findMany({
    where: { category, year, docName },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function create(authorId: string, data: { category: string; year: number; name: string; text: string }) {
  return prisma.documentNote.create({
    data: { category: data.category, year: data.year, docName: data.name, text: data.text, authorId },
    include: { author: { select: { id: true, fullName: true } } },
  });
}

export async function remove(id: string, userId: string) {
  const note = await prisma.documentNote.findUnique({ where: { id } });
  if (!note) throw new ApiError(404, "Nota no encontrada");
  if (note.authorId !== userId) throw new ApiError(403, "Solo quien escribió la nota puede borrarla");
  await prisma.documentNote.delete({ where: { id } });
}

export async function setDocumentStatus(data: {
  category: string;
  year: number;
  name: string;
  status: "ANULADO" | "STANDBY" | "SUSTITUIDO" | null;
  replacedBy?: string;
}) {
  if (!data.status) {
    await prisma.documentStatus.deleteMany({ where: { category: data.category, year: data.year, docName: data.name } });
    return null;
  }
  const replacedBy = data.status === "SUSTITUIDO" ? data.replacedBy || null : null;
  return prisma.documentStatus.upsert({
    where: { category_year_docName: { category: data.category, year: data.year, docName: data.name } },
    create: { category: data.category, year: data.year, docName: data.name, status: data.status, replacedBy },
    update: { status: data.status, replacedBy },
  });
}

export async function noteCounts(category: string, year: number) {
  const rows = await prisma.documentNote.groupBy({ by: ["docName"], where: { category, year }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.docName, r._count._all]));
}
