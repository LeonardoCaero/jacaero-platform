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
  name: z.string().min(1).max(300).optional(),
});

const docCategory = z.enum(["presupuesto", "albaran", "factura", "pedidoMaterial", "horasTrabajo"]);

export const createLinkSchema = z.object({
  fromCategory: docCategory,
  fromYear: z.number().int().min(2000).max(2100),
  fromName: z.string().min(1).max(300),
  toCategory: z.enum(["albaran", "factura"]),
  toYear: z.number().int().min(2000).max(2100),
  toNumber: z.string().regex(/^\d+$/),
  toName: z.string().min(1).max(300),
});

export const linkIdSchema = z.object({ id: z.string().min(1) });
