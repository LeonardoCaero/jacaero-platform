import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, getFileHandler, createShareHandler, getSharedFileHandler } from "./documents.controller.js";

export const documentsRoutes = Router();

// Public: the token itself is the authorization, so a shared link opens without logging in.
documentsRoutes.get("/share/file", getSharedFileHandler);

documentsRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

documentsRoutes.get("/:category", listHandler);
documentsRoutes.get("/:category/file", getFileHandler);
documentsRoutes.post("/:category/share", createShareHandler);
