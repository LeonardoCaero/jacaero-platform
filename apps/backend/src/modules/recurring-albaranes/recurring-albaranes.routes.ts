import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import {
  listHandler,
  clientsHandler,
  createHandler,
  removeHandler,
  draftHandler,
  previewHandler,
  generateHandler,
} from "./recurring-albaranes.controller.js";

export const recurringAlbaranesRoutes = Router();

recurringAlbaranesRoutes.use(authMiddleware, requirePermission("ORDERS:MANAGE"));

recurringAlbaranesRoutes.get("/", listHandler);
recurringAlbaranesRoutes.post("/", createHandler);
recurringAlbaranesRoutes.get("/clients", clientsHandler);
recurringAlbaranesRoutes.delete("/:id", removeHandler);
recurringAlbaranesRoutes.get("/:id/draft", draftHandler);
recurringAlbaranesRoutes.post("/:id/preview", previewHandler);
recurringAlbaranesRoutes.post("/:id/generate", generateHandler);
