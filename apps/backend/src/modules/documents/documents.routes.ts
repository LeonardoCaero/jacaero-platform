import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, getFileHandler, createLinkHandler, deleteLinkHandler } from "./documents.controller.js";

export const documentsRoutes = Router();

documentsRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

documentsRoutes.post("/links", createLinkHandler);
documentsRoutes.delete("/links/:id", deleteLinkHandler);
documentsRoutes.get("/:category", listHandler);
documentsRoutes.get("/:category/file", getFileHandler);
