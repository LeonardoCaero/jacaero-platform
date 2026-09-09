import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, previewHandler, confirmHandler } from "./recurring-albaranes.controller.js";

export const recurringAlbaranesRoutes = Router();

recurringAlbaranesRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

recurringAlbaranesRoutes.get("/", listHandler);
recurringAlbaranesRoutes.get("/:id/preview", previewHandler);
recurringAlbaranesRoutes.post("/:id/confirm", confirmHandler);
