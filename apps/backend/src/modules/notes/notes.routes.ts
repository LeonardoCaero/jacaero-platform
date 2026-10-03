import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, createHandler, deleteHandler, quoteStatusHandler } from "./notes.controller.js";

export const notesRoutes = Router();

notesRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

notesRoutes.get("/", listHandler);
notesRoutes.post("/", createHandler);
notesRoutes.put("/quote-status", quoteStatusHandler);
notesRoutes.delete("/:id", deleteHandler);
