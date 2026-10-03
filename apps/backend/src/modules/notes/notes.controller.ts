import type { Request, Response } from "express";
import { createNoteSchema, listNotesSchema, quoteStatusSchema } from "./notes.schema.js";
import * as notesService from "./notes.service.js";

export async function listHandler(req: Request, res: Response) {
  const { category, year, name } = listNotesSchema.parse(req.query);
  res.json(await notesService.list(category, year, name));
}

export async function createHandler(req: Request, res: Response) {
  res.status(201).json(await notesService.create(req.user!.userId, createNoteSchema.parse(req.body)));
}

export async function deleteHandler(req: Request<{ id: string }>, res: Response) {
  await notesService.remove(req.params.id, req.user!.userId);
  res.status(204).end();
}

export async function quoteStatusHandler(req: Request, res: Response) {
  res.json(await notesService.setQuoteStatus(quoteStatusSchema.parse(req.body)));
}
