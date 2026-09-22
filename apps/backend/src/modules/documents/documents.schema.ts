import { z } from "zod";

export const categorySchema = z.object({
  category: z.enum(["presupuesto", "albaran", "factura", "pedidoMaterial", "horasTrabajo"]),
});

export const listDocumentsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const getDocumentFileSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  number: z.string().regex(/^\d+$/),
  ext: z.enum(["pdf", "docx"]),
});
