import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().default(30),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("J.A. Caero <onboarding@resend.dev>"),
  INVITATION_EXPIRES_IN_DAYS: z.coerce.number().default(7),
});

export const env = envSchema.parse(process.env);
