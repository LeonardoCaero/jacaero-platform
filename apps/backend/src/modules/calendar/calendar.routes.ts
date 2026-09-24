import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { uploadPhotos } from "./photo-upload.js";
import {
  listHandler,
  peopleHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  uploadPhotosHandler,
  getPhotoHandler,
  deletePhotoHandler,
} from "./calendar.controller.js";

export const calendarRoutes = Router();

calendarRoutes.use(authMiddleware, requirePermission("CALENDAR:VIEW"));

calendarRoutes.get("/", listHandler);
calendarRoutes.get("/people", peopleHandler);
calendarRoutes.post("/", createHandler);
calendarRoutes.patch("/:id", updateHandler);
calendarRoutes.delete("/:id", deleteHandler);
calendarRoutes.post("/:id/photos", uploadPhotos.array("photos", 6), uploadPhotosHandler);
calendarRoutes.get("/:id/photos/:filename", getPhotoHandler);
calendarRoutes.delete("/:id/photos/:filename", deletePhotoHandler);
