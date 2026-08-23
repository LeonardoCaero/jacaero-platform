import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
});

export const acceptInvitationSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  password: z.string().min(8),
});
