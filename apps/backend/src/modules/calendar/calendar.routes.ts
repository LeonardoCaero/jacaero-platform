import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { listHandler, peopleHandler, createHandler, updateHandler, deleteHandler } from "./calendar.controller.js";

export const calendarRoutes = Router();

calendarRoutes.use(authMiddleware, requirePermission("CALENDAR:VIEW"));

calendarRoutes.get("/", listHandler);
calendarRoutes.get("/people", peopleHandler);
calendarRoutes.post("/", createHandler);
calendarRoutes.patch("/:id", updateHandler);
calendarRoutes.delete("/:id", deleteHandler);
