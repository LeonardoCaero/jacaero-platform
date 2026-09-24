import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listCalendarSchema = z.object({ from: day, to: day });

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    date: z.coerce.date(),
    endDate: z.coerce.date().nullish(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
    visibility: z.enum(["PERSONAL", "COMPANY"]),
    // With PERSONAL: empty = only me, otherwise shared with these people. Ignored with COMPANY.
    sharedWith: z.array(z.string()).max(100).default([]),
  })
  .refine((d) => !d.endDate || d.endDate >= d.date, { message: "endDate must be on or after date", path: ["endDate"] });
