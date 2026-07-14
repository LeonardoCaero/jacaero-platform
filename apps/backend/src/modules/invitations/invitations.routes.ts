import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import {
  listHandler,
  createHandler,
  getByTokenHandler,
  acceptHandler,
  deleteHandler,
} from "./invitations.controller.js";

export const invitationsRoutes = Router();

// public — the invited person isn't authenticated yet
invitationsRoutes.get("/:token", getByTokenHandler);
invitationsRoutes.post("/:token/accept", acceptHandler);

// admin
invitationsRoutes.get("/", authMiddleware, requirePermission("USERS:MANAGE"), listHandler);
invitationsRoutes.post("/", authMiddleware, requirePermission("USERS:MANAGE"), createHandler);
invitationsRoutes.delete("/:id", authMiddleware, requirePermission("USERS:MANAGE"), deleteHandler);
