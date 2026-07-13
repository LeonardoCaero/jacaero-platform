import { Router } from "express";
import { loginHandler, refreshHandler, logoutHandler, meHandler } from "./auth.controller.js";
import { authMiddleware } from "../../common/middlewares/auth.middleware.js";

export const authRoutes = Router();

authRoutes.post("/login", loginHandler);
authRoutes.post("/refresh", refreshHandler);
authRoutes.post("/logout", logoutHandler);
authRoutes.get("/me", authMiddleware, meHandler);
