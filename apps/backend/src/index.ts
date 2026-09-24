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
import { syncOrders, startImapIdleListener, syncFacturarOk } from "./modules/email-orders/email-orders.service.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { pushSubscriptionsRoutes } from "./modules/push-subscriptions/push-subscriptions.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { recurringAlbaranesRoutes } from "./modules/recurring-albaranes/recurring-albaranes.routes.js";
import { calendarRoutes } from "./modules/calendar/calendar.routes.js";
import { errorHandler } from "./common/middlewares/error-handler.middleware.js";
import { logger } from "./common/services/logger.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(","), credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: env.APP_VERSION });
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
app.use("/clients", clientsRoutes);
app.use("/recurring-albaranes", recurringAlbaranesRoutes);
app.use("/calendar", calendarRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`backend listening on port ${env.PORT}`);
});

if (env.ORDERS_EMAIL_ADDRESS && env.ORDERS_EMAIL_APP_PASSWORD) {
  syncOrders().catch((err) => logger.error("[email-orders] initial sync failed:", err));
  startImapIdleListener();
  // Time-based (2 days after the albarán went out), so it needs a clock rather than a mail event.
  const runFacturarOk = () =>
    syncFacturarOk().catch((err) => logger.error("[email-orders] FACTURAR OK sync failed:", err));
  runFacturarOk();
  setInterval(runFacturarOk, 60 * 60 * 1000);
}
