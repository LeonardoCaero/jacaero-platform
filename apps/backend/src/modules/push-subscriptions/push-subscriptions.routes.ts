import { Router } from "express";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";
import { vapidPublicKeyHandler, subscribeHandler, unsubscribeHandler } from "./push-subscriptions.controller.js";

export const pushSubscriptionsRoutes = Router();

pushSubscriptionsRoutes.use(authMiddleware);

pushSubscriptionsRoutes.get("/vapid-public-key", vapidPublicKeyHandler);
pushSubscriptionsRoutes.post("/", subscribeHandler);
pushSubscriptionsRoutes.post("/unsubscribe", unsubscribeHandler);
