import type { Request, Response } from "express";
import { loginSchema, refreshSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
}

export async function refreshHandler(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken);
  res.json(result);
}

export async function logoutHandler(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function meHandler(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.userId);
  res.json(user);
}
