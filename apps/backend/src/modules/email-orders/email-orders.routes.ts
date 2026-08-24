import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import {
  syncHandler,
  reconcileHandler,
  listHandler,
  getHandler,
  getPdfHandler,
  setMilestoneHandler,
  setQuoteStatusHandler,
  setFavoriteHandler,
  linkDocumentHandler,
} from "./email-orders.controller.js";

export const emailOrdersRoutes = Router();

emailOrdersRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

emailOrdersRoutes.post("/sync", syncHandler);
emailOrdersRoutes.post("/reconcile", reconcileHandler);
emailOrdersRoutes.get("/", listHandler);
emailOrdersRoutes.get("/:id", getHandler);
emailOrdersRoutes.get("/:id/pdf", getPdfHandler);
emailOrdersRoutes.patch("/:id/milestone", setMilestoneHandler);
emailOrdersRoutes.patch("/:id/quote-status", setQuoteStatusHandler);
emailOrdersRoutes.patch("/:id/favorite", setFavoriteHandler);
emailOrdersRoutes.patch("/:id/link", linkDocumentHandler);
