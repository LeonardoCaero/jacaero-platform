import { z } from "zod";

export const setMilestoneSchema = z.object({
  field: z.enum(["deliveryNoteAt", "invoicedAt"]),
  done: z.boolean(),
});

export const setQuoteStatusSchema = z.object({
  category: z.enum(["pending", "presupuesto", "horas", "material"]),
});

export const setFavoriteSchema = z.object({
  favorite: z.boolean(),
});

export const syncQuerySchema = z.object({
  full: z.coerce.boolean().optional().default(false),
});

export const reconcileQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
});
