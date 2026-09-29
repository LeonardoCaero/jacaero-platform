import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import {
  listHandler,
  draftHandler,
  previewHandler,
  existingPdfHandler,
  syncHandler,
  generateHandler,
} from "./recurring-albaranes.controller.js";

export const recurringAlbaranesRoutes = Router();

recurringAlbaranesRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

recurringAlbaranesRoutes.get("/", listHandler);
recurringAlbaranesRoutes.get("/:id/draft", draftHandler);
recurringAlbaranesRoutes.post("/:id/preview", previewHandler);
recurringAlbaranesRoutes.get("/documents/:docId/pdf", existingPdfHandler);
recurringAlbaranesRoutes.post("/:id/sync", syncHandler);
recurringAlbaranesRoutes.post("/:id/generate", generateHandler);
