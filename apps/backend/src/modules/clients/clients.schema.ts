import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  taxId: z.string().trim().max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(50).optional(),
});
export const updateClientSchema = createClientSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
});
export const updateLocationSchema = createLocationSchema.partial();

export const createContactSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().email(),
  phone: z.string().trim().max(50).optional(),
  jobTitle: z.string().trim().max(100).optional(),
});
export const updateContactSchema = createContactSchema.partial();

export const createContractSchema = z.object({
  label: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  hourlyRate: z.coerce.number().nonnegative(),
  overtimeRate: z.coerce.number().nonnegative(),
});
export const updateContractSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  hourlyRate: z.coerce.number().nonnegative().optional(),
  overtimeRate: z.coerce.number().nonnegative().optional(),
});
