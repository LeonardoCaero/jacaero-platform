import { z } from "zod";

const category = z.enum(["presupuesto", "albaran", "factura", "pedidoMaterial", "horasTrabajo", "pedido"]);
const year = z.coerce.number().int().min(0).max(2100);
const name = z.string().trim().min(1).max(300);

export const listNotesSchema = z.object({ category, year, name });

export const createNoteSchema = z.object({ category, year, name, text: z.string().trim().min(1).max(2000) });

export const documentStatusSchema = z.object({
  category: z.enum(["presupuesto", "albaran", "factura", "pedidoMaterial", "horasTrabajo"]).default("presupuesto"),
  year: z.number().int().min(2000).max(2100),
  name,
  status: z.enum(["ANULADO", "STANDBY", "SUSTITUIDO"]).nullable(),
  replacedBy: z.string().trim().max(100).optional(),
});
