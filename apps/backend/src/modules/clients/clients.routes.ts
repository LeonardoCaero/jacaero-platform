import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { requirePermission } from "../../common/middlewares/require-permission.middleware.js";
import {
  listHandler,
  getHandler,
  createHandler,
  updateHandler,
  addLocationHandler,
  updateLocationHandler,
  removeLocationHandler,
  addContactHandler,
  updateContactHandler,
  removeContactHandler,
  addContractHandler,
  updateContractHandler,
} from "./clients.controller.js";

export const clientsRoutes = Router();

clientsRoutes.use(authMiddleware, requirePermission("CLIENTS:MANAGE"));

clientsRoutes.get("/", listHandler);
clientsRoutes.post("/", createHandler);
clientsRoutes.get("/:id", getHandler);
clientsRoutes.patch("/:id", updateHandler);

clientsRoutes.post("/:id/locations", addLocationHandler);
clientsRoutes.patch("/locations/:locationId", updateLocationHandler);
clientsRoutes.delete("/locations/:locationId", removeLocationHandler);

clientsRoutes.post("/:id/contacts", addContactHandler);
clientsRoutes.patch("/contacts/:contactId", updateContactHandler);
clientsRoutes.delete("/contacts/:contactId", removeContactHandler);

clientsRoutes.post("/:id/contracts", addContractHandler);
clientsRoutes.patch("/contracts/:contractId", updateContractHandler);
