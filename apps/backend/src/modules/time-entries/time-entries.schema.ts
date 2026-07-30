import { z } from "zod";

export const createTimeEntrySchema = z.object({
  date: z.coerce.date(),
  hours: z.coerce.number().positive().max(24),
  description: z.string().trim().max(500).optional(),
  isOvertime: z.boolean().optional().default(false),
});

export const updateTimeEntrySchema = createTimeEntrySchema.partial();

export const listTimeEntriesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  userId: z.string().optional(),
});

export const teamSummarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
