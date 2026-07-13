import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, createHandler, updateHandler, deleteHandler } from "./time-entries.controller.js";

export const timeEntriesRoutes = Router();

timeEntriesRoutes.use(authMiddleware);

timeEntriesRoutes.get("/", requirePermission("TIME:VIEW_OWN"), listHandler);
timeEntriesRoutes.post("/", requirePermission("TIME:CREATE_OWN"), createHandler);
timeEntriesRoutes.patch("/:id", requirePermission("TIME:CREATE_OWN"), updateHandler);
timeEntriesRoutes.delete("/:id", requirePermission("TIME:CREATE_OWN"), deleteHandler);
