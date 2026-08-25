import type { Request, Response } from "express";
import {
  createClientSchema,
  updateClientSchema,
  createLocationSchema,
  updateLocationSchema,
  createContactSchema,
  updateContactSchema,
  createContractSchema,
  updateContractSchema,
} from "./clients.schema.js";
import * as clientsService from "./clients.service.js";

export async function listHandler(_req: Request, res: Response) {
  res.json(await clientsService.list());
}

export async function getHandler(req: Request<{ id: string }>, res: Response) {
  res.json(await clientsService.get(req.params.id));
}

export async function createHandler(req: Request, res: Response) {
  const data = createClientSchema.parse(req.body);
  res.status(201).json(await clientsService.create(data));
}

export async function updateHandler(req: Request<{ id: string }>, res: Response) {
  const data = updateClientSchema.parse(req.body);
  res.json(await clientsService.update(req.params.id, data));
}

export async function addLocationHandler(req: Request<{ id: string }>, res: Response) {
  const data = createLocationSchema.parse(req.body);
  res.status(201).json(await clientsService.addLocation(req.params.id, data));
}

export async function updateLocationHandler(req: Request<{ locationId: string }>, res: Response) {
  const data = updateLocationSchema.parse(req.body);
  res.json(await clientsService.updateLocation(req.params.locationId, data));
}

export async function removeLocationHandler(req: Request<{ locationId: string }>, res: Response) {
  await clientsService.removeLocation(req.params.locationId);
  res.status(204).send();
}

export async function addContactHandler(req: Request<{ id: string }>, res: Response) {
  const data = createContactSchema.parse(req.body);
  res.status(201).json(await clientsService.addContact(req.params.id, data));
}

export async function updateContactHandler(req: Request<{ contactId: string }>, res: Response) {
  const data = updateContactSchema.parse(req.body);
  res.json(await clientsService.updateContact(req.params.contactId, data));
}

export async function removeContactHandler(req: Request<{ contactId: string }>, res: Response) {
  await clientsService.removeContact(req.params.contactId);
  res.status(204).send();
}

export async function addContractHandler(req: Request<{ id: string }>, res: Response) {
  const data = createContractSchema.parse(req.body);
  res.status(201).json(await clientsService.addContract(req.params.id, data));
}

export async function updateContractHandler(req: Request<{ contractId: string }>, res: Response) {
  const data = updateContractSchema.parse(req.body);
  res.json(await clientsService.updateContract(req.params.contractId, data));
}
