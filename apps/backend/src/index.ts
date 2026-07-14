import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { timeEntriesRoutes } from "./modules/time-entries/time-entries.routes.js";
import { rolesRoutes } from "./modules/roles/roles.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { invitationsRoutes } from "./modules/invitations/invitations.routes.js";
import { errorHandler } from "./common/middlewares/error-handler.middleware.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN.split(","), credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/time-entries", timeEntriesRoutes);
app.use("/roles", rolesRoutes);
app.use("/users", usersRoutes);
app.use("/invitations", invitationsRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`backend listening on port ${env.PORT}`);
});
