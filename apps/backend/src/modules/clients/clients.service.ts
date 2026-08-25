import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import type {
  createClientSchema,
  updateClientSchema,
  createLocationSchema,
  updateLocationSchema,
  createContactSchema,
  updateContactSchema,
  createContractSchema,
  updateContractSchema,
} from "./clients.schema.js";
import type { z } from "zod";

type CreateClientInput = z.infer<typeof createClientSchema>;
type UpdateClientInput = z.infer<typeof updateClientSchema>;
type CreateLocationInput = z.infer<typeof createLocationSchema>;
type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
type CreateContactInput = z.infer<typeof createContactSchema>;
type UpdateContactInput = z.infer<typeof updateContactSchema>;
type CreateContractInput = z.infer<typeof createContractSchema>;
type UpdateContractInput = z.infer<typeof updateContractSchema>;

// One ContractResource per ClientContract holds the hourly rate; contracts don't need
// the full multi-resource setup yet, so it's created/kept transparently, not exposed in the API.
const contractInclude = {
  resources: { include: { rates: { orderBy: { period: "desc" as const }, take: 1 } } },
  overtimeRates: { orderBy: { period: "desc" as const }, take: 1 },
} as const;

type ContractWithRates = {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  status: string;
  resources: { id: string; rates: { id: string; hourlyRate: unknown }[] }[];
  overtimeRates: { id: string; rate: unknown }[];
};

function toContractDto(contract: ContractWithRates) {
  const rate = contract.resources[0]?.rates[0];
  const overtime = contract.overtimeRates[0];
  return {
    id: contract.id,
    label: contract.label,
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
    hourlyRate: rate ? Number(rate.hourlyRate) : null,
    overtimeRate: overtime ? Number(overtime.rate) : null,
  };
}

export async function list() {
  return prisma.client.findMany({
    select: {
      id: true,
      name: true,
      taxId: true,
      email: true,
      phone: true,
      status: true,
      _count: { select: { contracts: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function findOrThrow(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { locations: true, contacts: true, contracts: { include: contractInclude, orderBy: { startDate: "desc" } } },
  });
  if (!client) throw new ApiError(404, "Client not found");
  return client;
}

export async function get(id: string) {
  const client = await findOrThrow(id);
  const { contracts, ...rest } = client;
  return { ...rest, contracts: contracts.map(toContractDto) };
}

export async function create(data: CreateClientInput) {
  return prisma.client.create({ data });
}

export async function update(id: string, data: UpdateClientInput) {
  await findOrThrow(id);
  return prisma.client.update({ where: { id }, data });
}

export async function addLocation(clientId: string, data: CreateLocationInput) {
  await findOrThrow(clientId);
  return prisma.clientLocation.create({ data: { clientId, ...data } });
}

export async function updateLocation(id: string, data: UpdateLocationInput) {
  return prisma.clientLocation.update({ where: { id }, data });
}

export async function removeLocation(id: string) {
  await prisma.clientLocation.delete({ where: { id } });
}

export async function addContact(clientId: string, data: CreateContactInput) {
  await findOrThrow(clientId);
  return prisma.clientContact.create({ data: { clientId, ...data } });
}

export async function updateContact(id: string, data: UpdateContactInput) {
  return prisma.clientContact.update({ where: { id }, data });
}

export async function removeContact(id: string) {
  await prisma.clientContact.delete({ where: { id } });
}

export async function addContract(clientId: string, data: CreateContractInput) {
  await findOrThrow(clientId);

  const contract = await prisma.clientContract.create({
    data: { clientId, label: data.label, startDate: data.startDate, endDate: data.endDate },
  });
  const resource = await prisma.contractResource.create({
    data: { contractId: contract.id, name: data.label },
  });
  await prisma.contractResourceRate.create({
    data: { contractResourceId: resource.id, period: data.startDate, hourlyRate: data.hourlyRate },
  });
  await prisma.contractOvertimeRate.create({
    data: { contractId: contract.id, period: data.startDate, rate: data.overtimeRate },
  });

  const full = await prisma.clientContract.findUniqueOrThrow({ where: { id: contract.id }, include: contractInclude });
  return toContractDto(full);
}

export async function updateContract(id: string, data: UpdateContractInput) {
  const contract = await prisma.clientContract.findUnique({ where: { id }, include: contractInclude });
  if (!contract) throw new ApiError(404, "Contract not found");

  const { hourlyRate, overtimeRate, ...contractFields } = data;

  if (Object.keys(contractFields).length > 0) {
    await prisma.clientContract.update({ where: { id }, data: contractFields });
  }

  if (hourlyRate !== undefined) {
    const resource = contract.resources[0];
    const currentRate = resource.rates[0];
    if (currentRate) {
      await prisma.contractResourceRate.update({ where: { id: currentRate.id }, data: { hourlyRate } });
    } else {
      await prisma.contractResourceRate.create({
        data: { contractResourceId: resource.id, period: contract.startDate, hourlyRate },
      });
    }
  }

  if (overtimeRate !== undefined) {
    const currentOvertime = contract.overtimeRates[0];
    if (currentOvertime) {
      await prisma.contractOvertimeRate.update({ where: { id: currentOvertime.id }, data: { rate: overtimeRate } });
    } else {
      await prisma.contractOvertimeRate.create({
        data: { contractId: id, period: contract.startDate, rate: overtimeRate },
      });
    }
  }

  const full = await prisma.clientContract.findUniqueOrThrow({ where: { id }, include: contractInclude });
  return toContractDto(full);
}
