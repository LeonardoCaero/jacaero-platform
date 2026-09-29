import type { Request, Response } from "express";
import { createOrderSchema, draftQuerySchema, generateBodySchema, parsePeriod } from "./recurring-albaranes.schema.js";
import * as recurringAlbaranesService from "./recurring-albaranes.service.js";

export async function listHandler(_req: Request, res: Response) {
  res.json(await recurringAlbaranesService.list());
}

export async function draftHandler(req: Request<{ id: string }>, res: Response) {
  const { period, kind } = draftQuerySchema.parse(req.query);
  res.json(await recurringAlbaranesService.draft(req.params.id, kind, parsePeriod(period)));
}

export async function previewHandler(req: Request<{ id: string }>, res: Response) {
  const { kind, ...body } = generateBodySchema.parse(req.body);
  const pdf = await recurringAlbaranesService.previewPdf(req.params.id, kind, body);
  res.setHeader("Content-Type", "application/pdf");
  res.send(pdf);
}

export async function generateHandler(req: Request<{ id: string }>, res: Response) {
  const { kind, period, ...body } = generateBodySchema.parse(req.body);
  res.json(await recurringAlbaranesService.generate(req.params.id, kind, parsePeriod(period), body));
}

export async function clientsHandler(_req: Request, res: Response) {
  res.json(await recurringAlbaranesService.clients());
}

export async function createHandler(req: Request, res: Response) {
  res.status(201).json(await recurringAlbaranesService.create(createOrderSchema.parse(req.body)));
}

export async function removeHandler(req: Request<{ id: string }>, res: Response) {
  await recurringAlbaranesService.remove(req.params.id);
  res.status(204).end();
}
