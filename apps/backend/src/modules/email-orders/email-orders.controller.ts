import type { Request, Response } from "express";
import { setMilestoneSchema } from "./email-orders.schema.js";
import * as emailOrdersService from "./email-orders.service.js";

export async function syncHandler(_req: Request, res: Response) {
  res.json(await emailOrdersService.syncOrders());
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
