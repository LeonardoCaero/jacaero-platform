import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import { uploadPhotos } from "./photo-upload.js";
import {
  listHandler,
  createHandler,
  updateHandler,
  deleteHandler,
  teamSummaryHandler,
  teamDayHandler,
  uploadPhotosHandler,
  getPhotoHandler,
  deletePhotoHandler,
} from "./time-entries.controller.js";

export const timeEntriesRoutes = Router();

timeEntriesRoutes.use(authMiddleware);

timeEntriesRoutes.get("/", requirePermission("TIME:VIEW_OWN"), listHandler);
timeEntriesRoutes.get("/team-summary", requirePermission("TIME:VIEW_ALL"), teamSummaryHandler);
timeEntriesRoutes.get("/team-day", requirePermission("TIME:VIEW_ALL"), teamDayHandler);
timeEntriesRoutes.post("/", requirePermission("TIME:CREATE_OWN"), createHandler);
timeEntriesRoutes.patch("/:id", requirePermission("TIME:CREATE_OWN"), updateHandler);
timeEntriesRoutes.delete("/:id", requirePermission("TIME:CREATE_OWN"), deleteHandler);
timeEntriesRoutes.post("/:id/photos", requirePermission("TIME:CREATE_OWN"), uploadPhotos.array("photos", 6), uploadPhotosHandler);
timeEntriesRoutes.get("/:id/photos/:filename", requirePermission("TIME:VIEW_OWN"), getPhotoHandler);
timeEntriesRoutes.delete("/:id/photos/:filename", requirePermission("TIME:CREATE_OWN"), deletePhotoHandler);
