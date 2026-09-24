import type { Request, Response } from "express";
import { calendarEventSchema, listCalendarSchema } from "./calendar.schema.js";
import * as calendarService from "./calendar.service.js";

export async function listHandler(req: Request, res: Response) {
  const { from, to } = listCalendarSchema.parse(req.query);
  res.json(await calendarService.list(req.user!.userId, from, to));
}

export async function peopleHandler(_req: Request, res: Response) {
  res.json(await calendarService.people());
}

export async function createHandler(req: Request, res: Response) {
  const data = calendarEventSchema.parse(req.body);
  res.status(201).json(await calendarService.create(req.user!.userId, data));
}

export async function updateHandler(req: Request<{ id: string }>, res: Response) {
  const data = calendarEventSchema.parse(req.body);
  res.json(await calendarService.update(req.params.id, req.user!.userId, data));
}

export async function deleteHandler(req: Request<{ id: string }>, res: Response) {
  await calendarService.remove(req.params.id, req.user!.userId);
  res.status(204).send();
}

export async function uploadPhotosHandler(req: Request<{ id: string }>, res: Response) {
  res.status(201).json(await calendarService.addPhotos(req.params.id, req.user!.userId, req.files as Express.Multer.File[]));
}

export async function getPhotoHandler(req: Request<{ id: string; filename: string }>, res: Response) {
  res.sendFile(await calendarService.getPhotoPath(req.params.id, req.user!.userId, req.params.filename));
}

export async function deletePhotoHandler(req: Request<{ id: string; filename: string }>, res: Response) {
  await calendarService.removePhoto(req.params.id, req.user!.userId, req.params.filename);
  res.status(204).send();
}
