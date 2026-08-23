import type { Request, Response } from "express";
import { createRoleSchema, updateRoleSchema } from "./roles.schema.js";
import * as rolesService from "./roles.service.js";

export async function listHandler(_req: Request, res: Response) {
  res.json(await rolesService.list());
}

export async function listPermissionsHandler(_req: Request, res: Response) {
  res.json(await rolesService.listPermissions());
}

export async function createHandler(req: Request, res: Response) {
  const data = createRoleSchema.parse(req.body);
  res.status(201).json(await rolesService.create(data));
}

export async function updateHandler(req: Request<{ id: string }>, res: Response) {
  const data = updateRoleSchema.parse(req.body);
  res.json(await rolesService.update(req.params.id, data));
}

export async function deleteHandler(req: Request<{ id: string }>, res: Response) {
  await rolesService.remove(req.params.id);
  res.status(204).send();
}
