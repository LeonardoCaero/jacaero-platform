import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { timeEntriesRoutes } from "./modules/time-entries/time-entries.routes.js";
import { rolesRoutes } from "./modules/roles/roles.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { invitationsRoutes } from "./modules/invitations/invitations.routes.js";
import { emailOrdersRoutes } from "./modules/email-orders/email-orders.routes.js";
import { syncOrders } from "./modules/email-orders/email-orders.service.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { pushSubscriptionsRoutes } from "./modules/push-subscriptions/push-subscriptions.routes.js";
import { errorHandler } from "./common/middlewares/error-handler.middleware.js";
import { logger } from "./common/services/logger.js";

const app = express();

// Trust the nginx reverse proxy in front of us (single hop) so express-rate-limit
// and req.ip see the real client IP from X-Forwarded-For instead of nginx's own.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(","), credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
app.use("/auth/login", loginLimiter);

app.use("/auth", authRoutes);
app.use("/time-entries", timeEntriesRoutes);
app.use("/roles", rolesRoutes);
app.use("/users", usersRoutes);
app.use("/invitations", invitationsRoutes);
app.use("/email-orders", emailOrdersRoutes);
app.use("/documents", documentsRoutes);
app.use("/push-subscriptions", pushSubscriptionsRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`backend listening on port ${env.PORT}`);
});

if (env.ORDERS_EMAIL_ADDRESS && env.ORDERS_EMAIL_APP_PASSWORD) {
  const pollMs = env.ORDERS_POLL_MINUTES * 60 * 1000;
  syncOrders().catch((err) => logger.error("[email-orders] initial sync failed:", err));
  setInterval(() => {
    syncOrders().catch((err) => logger.error("[email-orders] sync failed:", err));
  }, pollMs);
}
