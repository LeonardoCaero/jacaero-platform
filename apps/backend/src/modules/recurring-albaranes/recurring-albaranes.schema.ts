import { z } from "zod";

const period = z.string().regex(/^\d{4}-\d{2}$/);
const kind = z.enum(["albaran", "factura"]);

export const draftQuerySchema = z.object({ period, kind });
export const periodQuerySchema = z.object({ period });

export const draftBodySchema = z.object({
  number: z.string().regex(/^\d{1,4}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conceptLines: z.array(z.string().max(300)),
  baseAmount: z.number().nonnegative().max(10_000_000),
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[^\\/:*?"<>|]+$/, "El nombre no puede llevar \\ / : * ? \" < > |"),
});

export type DraftBody = z.infer<typeof draftBodySchema>;

export const generateBodySchema = draftBodySchema.extend({ period, kind });

export function parsePeriod(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}
