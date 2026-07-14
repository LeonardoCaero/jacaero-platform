import type { Request, Response } from "express";
import { createInvitationSchema, acceptInvitationSchema } from "./invitations.schema.js";
import * as invitationsService from "./invitations.service.js";

export async function listHandler(_req: Request, res: Response) {
  res.json(await invitationsService.list());
}

export async function createHandler(req: Request, res: Response) {
  const data = createInvitationSchema.parse(req.body);
  const invitation = await invitationsService.create(data);
  res.status(201).json({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt });
}

export async function getByTokenHandler(req: Request<{ token: string }>, res: Response) {
  res.json(await invitationsService.getByToken(req.params.token));
}

export async function acceptHandler(req: Request<{ token: string }>, res: Response) {
  const data = acceptInvitationSchema.parse(req.body);
  res.json(await invitationsService.accept(req.params.token, data));
}

export async function deleteHandler(req: Request<{ id: string }>, res: Response) {
  await invitationsService.remove(req.params.id);
  res.status(204).send();
}

export async function resendHandler(req: Request<{ id: string }>, res: Response) {
  res.json(await invitationsService.resend(req.params.id));
}

export async function previewHandler(req: Request<{ id: string }>, res: Response) {
  const { html } = await invitationsService.preview(req.params.id);
  res.json({ html });
}
