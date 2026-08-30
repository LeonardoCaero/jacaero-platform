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
  EMAIL_FROM: z.string().default("J.A. Caero <notificaciones@caero.group>"),
  INVITATION_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  ORDERS_IMAP_HOST: z.string().default("imap.gmail.com"),
  ORDERS_EMAIL_ADDRESS: z.string().optional(),
  ORDERS_EMAIL_APP_PASSWORD: z.string().optional(),
  ORDERS_SENDER_ALLOWLIST: z.string().optional(),
  DOCS_ROOT_PATH: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
  APP_VERSION: z.string().default("dev"),
});

export const env = envSchema.parse(process.env);
