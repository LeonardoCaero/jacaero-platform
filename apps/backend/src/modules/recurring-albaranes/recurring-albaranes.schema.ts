import { z } from "zod";

export const periodQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export const periodBodySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export function parsePeriod(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}
