import type { Request, Response } from "express";
import { subscribeSchema, unsubscribeSchema } from "./push-subscriptions.schema.js";
import * as pushService from "./push-subscriptions.service.js";

export function vapidPublicKeyHandler(_req: Request, res: Response) {
  res.json({ publicKey: pushService.getVapidPublicKey() });
}

export async function subscribeHandler(req: Request, res: Response) {
  const data = subscribeSchema.parse(req.body);
  await pushService.subscribe(req.user!.userId, { endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth });
  res.status(204).send();
}

export async function unsubscribeHandler(req: Request, res: Response) {
  const data = unsubscribeSchema.parse(req.body);
  await pushService.unsubscribe(data.endpoint);
  res.status(204).send();
}
