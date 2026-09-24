import type { Prisma } from "@prisma/client";

// Admins (CALENDAR:MANAGE) see every note, including other people's private ones.
export function visibilityFilter(requesterId: string, admin: boolean): Prisma.CalendarEventWhereInput {
  if (admin) return {};
  return {
    OR: [{ visibility: "COMPANY" }, { createdBy: requesterId }, { assignees: { some: { userId: requesterId } } }],
  };
}
