import type { Request, Response } from "express";
import { periodQuerySchema, periodBodySchema, parsePeriod } from "./recurring-albaranes.schema.js";
import * as recurringAlbaranesService from "./recurring-albaranes.service.js";

export async function listHandler(_req: Request, res: Response) {
  res.json(await recurringAlbaranesService.list());
}

export async function previewHandler(req: Request<{ id: string }>, res: Response) {
  const { period } = periodQuerySchema.parse(req.query);
  const pdf = await recurringAlbaranesService.previewPdf(req.params.id, parsePeriod(period));
  res.setHeader("Content-Type", "application/pdf");
  res.send(pdf);
}

export async function confirmHandler(req: Request<{ id: string }>, res: Response) {
  const { period } = periodBodySchema.parse(req.body);
  res.json(await recurringAlbaranesService.confirm(req.params.id, parsePeriod(period)));
}
