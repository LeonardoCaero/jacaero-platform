import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { generateRefreshToken, hashToken } from "../../common/utils/tokens.util.js";
import { env } from "../../config/env.js";
import { sendInvitationEmail, buildInvitationEmail, type Lang } from "../../common/services/email.service.js";
import { issueTokens, getMe } from "../auth/auth.service.js";
import type { createInvitationSchema, acceptInvitationSchema } from "./invitations.schema.js";
import type { z } from "zod";

type CreateInput = z.infer<typeof createInvitationSchema>;
type AcceptInput = z.infer<typeof acceptInvitationSchema>;

function resolveRoleName(role: { name: string; nameEn: string | null }, lang: string) {
  return lang === "en" && role.nameEn ? role.nameEn : role.name;
}

export async function list() {
  return prisma.invitation.findMany({
    where: { acceptedAt: null },
    include: { role: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(data: CreateInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) {
    throw new ApiError(400, "Role not found");
  }

  const rawToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: { email: data.email, roleId: data.roleId, tokenHash: hashToken(rawToken), expiresAt, lang: data.lang },
  });

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${rawToken}`;
  await sendInvitationEmail(data.email, inviteUrl, resolveRoleName(role, data.lang), data.lang);

  return invitation;
}

async function findValid(token: string) {
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash: hashToken(token), acceptedAt: null, expiresAt: { gt: new Date() } },
    include: { role: { select: { name: true } } },
  });
  if (!invitation) {
    throw new ApiError(404, "Invitation not found or expired");
  }
  return invitation;
}

export async function getByToken(token: string) {
  const invitation = await findValid(token);
  return { email: invitation.email, roleName: invitation.role.name };
}

export async function accept(token: string, data: AcceptInput) {
  const invitation = await findValid(token);

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { email: invitation.email, passwordHash, fullName: data.fullName, roleId: invitation.roleId },
  });

  await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });

  const tokens = await issueTokens(user.id, user.email);
  return { ...tokens, user: await getMe(user.id) };
}

async function findPending(id: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: { role: { select: { name: true, nameEn: true } } },
  });
  if (!invitation || invitation.acceptedAt) {
    throw new ApiError(404, "Invitation not found");
  }
  return invitation;
}

export async function resend(id: string) {
  const invitation = await findPending(id);

  const rawToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  await prisma.invitation.update({ where: { id }, data: { tokenHash: hashToken(rawToken), expiresAt } });

  const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${rawToken}`;
  await sendInvitationEmail(invitation.email, inviteUrl, resolveRoleName(invitation.role, invitation.lang), invitation.lang as Lang);

  return { id: invitation.id, email: invitation.email, expiresAt };
}

export async function preview(id: string) {
  const invitation = await findPending(id);
  const previewUrl = `${env.FRONTEND_URL}/accept-invite?token=preview`;
  return buildInvitationEmail(previewUrl, resolveRoleName(invitation.role, invitation.lang), invitation.lang as Lang, true);
}

export async function remove(id: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }
  await prisma.invitation.delete({ where: { id } });
}
