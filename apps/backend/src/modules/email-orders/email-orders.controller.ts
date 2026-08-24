import type { Request, Response } from "express";
import {
  setMilestoneSchema,
  setQuoteStatusSchema,
  setFavoriteSchema,
  syncQuerySchema,
  reconcileQuerySchema,
  linkDocumentSchema,
} from "./email-orders.schema.js";
import * as emailOrdersService from "./email-orders.service.js";

export async function syncHandler(req: Request, res: Response) {
  const { full } = syncQuerySchema.parse(req.query);
  res.json(await emailOrdersService.syncOrders({ full }));
}

export async function reconcileHandler(req: Request, res: Response) {
  const { year } = reconcileQuerySchema.parse(req.query);
  res.json(await emailOrdersService.reconcileDocuments(year));
}

export async function listHandler(_req: Request, res: Response) {
  res.json(await emailOrdersService.list());
}

export async function getHandler(req: Request<{ id: string }>, res: Response) {
  res.json(await emailOrdersService.get(req.params.id));
}

export async function getPdfHandler(req: Request<{ id: string }>, res: Response) {
  const pdf = await emailOrdersService.getPdf(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.send(Buffer.from(pdf));
}

export async function setMilestoneHandler(req: Request<{ id: string }>, res: Response) {
  const { field, done } = setMilestoneSchema.parse(req.body);
  res.json(await emailOrdersService.setMilestone(req.params.id, field, done));
}

export async function setQuoteStatusHandler(req: Request<{ id: string }>, res: Response) {
  const { category } = setQuoteStatusSchema.parse(req.body);
  res.json(await emailOrdersService.setQuoteStatus(req.params.id, category));
}

export async function setFavoriteHandler(req: Request<{ id: string }>, res: Response) {
  const { favorite } = setFavoriteSchema.parse(req.body);
  res.json(await emailOrdersService.setFavorite(req.params.id, favorite));
}

export async function linkDocumentHandler(req: Request<{ id: string }>, res: Response) {
  const { category, number } = linkDocumentSchema.parse(req.body);
  res.json(await emailOrdersService.linkDocument(req.params.id, category, number));
}
