import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { createRoleSchema, updateRoleSchema } from "./roles.schema.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof createRoleSchema>;
type UpdateInput = z.infer<typeof updateRoleSchema>;

const roleWithPermissions = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

function toPublicRole(role: {
  id: string;
  name: string;
  isSystem: boolean;
  _count: { users: number };
  permissions: { permission: { key: string } }[];
}) {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissions: role.permissions.map((rp) => rp.permission.key),
  };
}

export async function list() {
  const roles = await prisma.role.findMany({ include: roleWithPermissions, orderBy: { name: "asc" } });
  return roles.map(toPublicRole);
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: { key: "asc" } });
}

export async function create(data: CreateInput) {
  const permissions = await prisma.permission.findMany({ where: { key: { in: data.permissionKeys } } });
  const role = await prisma.role.create({
    data: { name: data.name, permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } },
    include: roleWithPermissions,
  });
  return toPublicRole(role);
}

export async function update(id: string, data: UpdateInput) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, "Role not found");
  }

  if (data.permissionKeys) {
    const permissions = await prisma.permission.findMany({ where: { key: { in: data.permissionKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: id, permissionId: p.id })) });
  }

  if (data.name) {
    await prisma.role.update({ where: { id }, data: { name: data.name } });
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { id }, include: roleWithPermissions });
  return toPublicRole(role);
}

export async function remove(id: string) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  if (role.isSystem) {
    throw new ApiError(400, "Cannot delete a system role");
  }
  if (role._count.users > 0) {
    throw new ApiError(409, "Cannot delete a role with assigned users");
  }

  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  await prisma.role.delete({ where: { id } });
}
