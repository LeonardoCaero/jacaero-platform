import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, updateHandler } from "./users.controller.js";

export const usersRoutes = Router();

usersRoutes.use(authMiddleware, requirePermission("USERS:MANAGE"));

usersRoutes.get("/", listHandler);
usersRoutes.patch("/:id", updateHandler);
