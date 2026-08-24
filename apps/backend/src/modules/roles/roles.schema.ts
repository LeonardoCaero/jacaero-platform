import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().max(100).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  nameEn: z.string().trim().max(100).optional(),
  permissionKeys: z.array(z.string()).optional(),
});
