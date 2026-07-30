import { z } from "zod";

export const setMilestoneSchema = z.object({
  field: z.enum(["quotedAt", "deliveryNoteAt", "invoicedAt"]),
  done: z.boolean(),
});
