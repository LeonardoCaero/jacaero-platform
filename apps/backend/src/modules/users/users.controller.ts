import type { Request, Response } from "express";
import { updateUserSchema } from "./users.schema.js";
import * as usersService from "./users.service.js";

export async function listHandler(_req: Request, res: Response) {
  res.json(await usersService.list());
}

export async function updateHandler(req: Request<{ id: string }>, res: Response) {
  const data = updateUserSchema.parse(req.body);
  const user = await usersService.update(req.params.id, req.user!.userId, data);
  res.json(user);
}

export async function deleteHandler(req: Request<{ id: string }>, res: Response) {
  await usersService.remove(req.params.id, req.user!.userId);
  res.status(204).send();
}
