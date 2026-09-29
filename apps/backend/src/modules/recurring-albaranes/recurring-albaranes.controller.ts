import type { Request, Response } from "express";
import {
  draftQuerySchema,
  generateBodySchema,
  kindQuerySchema,
  parsePeriod,
  periodQuerySchema,
} from "./recurring-albaranes.schema.js";
import * as recurringAlbaranesService from "./recurring-albaranes.service.js";

export async function listHandler(req: Request, res: Response) {
  const { period } = periodQuerySchema.parse(req.query);
  res.json(await recurringAlbaranesService.list(parsePeriod(period)));
}

export async function draftHandler(req: Request<{ id: string }>, res: Response) {
  const { period, kind } = draftQuerySchema.parse(req.query);
  res.json(await recurringAlbaranesService.draft(req.params.id, kind, parsePeriod(period)));
}

export async function previewHandler(req: Request<{ id: string }>, res: Response) {
  const { kind, period: _period, ...body } = generateBodySchema.parse(req.body);
  const pdf = await recurringAlbaranesService.previewPdf(req.params.id, kind, body);
  res.setHeader("Content-Type", "application/pdf");
  res.send(pdf);
}

export async function existingPdfHandler(req: Request<{ id: string }>, res: Response) {
  const { kind } = kindQuerySchema.parse(req.query);
  res.setHeader("Content-Type", "application/pdf");
  res.send(await recurringAlbaranesService.existingPdf(req.params.id, kind));
}

export async function generateHandler(req: Request<{ id: string }>, res: Response) {
  const { kind, period, ...body } = generateBodySchema.parse(req.body);
  res.json(await recurringAlbaranesService.generate(req.params.id, kind, parsePeriod(period), body));
}
