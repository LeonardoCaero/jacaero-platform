import { z } from "zod";

export const updateUserSchema = z.object({
  roleId: z.string().nullable().optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
