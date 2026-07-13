import type { Request, Response } from "express";
import { createTimeEntrySchema, updateTimeEntrySchema, listTimeEntriesSchema } from "./time-entries.schema.js";
import * as timeEntriesService from "./time-entries.service.js";

export async function listHandler(req: Request, res: Response) {
  const { month } = listTimeEntriesSchema.parse(req.query);
  const entries = await timeEntriesService.list(req.user!.userId, month);
  res.json(entries);
}

export async function createHandler(req: Request, res: Response) {
  const data = createTimeEntrySchema.parse(req.body);
  const entry = await timeEntriesService.create(req.user!.userId, data);
  res.status(201).json(entry);
}

export async function updateHandler(req: Request<{ id: string }>, res: Response) {
  const data = updateTimeEntrySchema.parse(req.body);
  const entry = await timeEntriesService.update(req.params.id, req.user!.userId, data);
  res.json(entry);
}

export async function deleteHandler(req: Request<{ id: string }>, res: Response) {
  await timeEntriesService.remove(req.params.id, req.user!.userId);
  res.status(204).send();
}
