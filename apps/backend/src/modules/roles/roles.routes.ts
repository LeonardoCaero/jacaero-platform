import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import {
  listHandler,
  listPermissionsHandler,
  createHandler,
  updateHandler,
  deleteHandler,
} from "./roles.controller.js";

export const rolesRoutes = Router();

rolesRoutes.use(authMiddleware, requirePermission("USERS:MANAGE"));

rolesRoutes.get("/", listHandler);
rolesRoutes.get("/permissions", listPermissionsHandler);
rolesRoutes.post("/", createHandler);
rolesRoutes.patch("/:id", updateHandler);
rolesRoutes.delete("/:id", deleteHandler);
