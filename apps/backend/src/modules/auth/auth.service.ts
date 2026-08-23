import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { ApiError } from "../../common/errors/api-error.js";
import { signAccessToken } from "../../common/utils/jwt.util.js";
import { generateRefreshToken, hashToken } from "../../common/utils/tokens.util.js";
import { env } from "../../config/env.js";

const userWithRole = {
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  role: { name: string; permissions: { permission: { key: string } }[] } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle,
    role: user.role?.name ?? null,
    permissions: user.role?.permissions.map((rp) => rp.permission.key) ?? [],
  };
}

export async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: userWithRole });

  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const tokens = await issueTokens(user.id, user.email);
  return { ...tokens, user: toPublicUser(user) };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!stored) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId }, include: userWithRole });
  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(401, "Invalid refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const tokens = await issueTokens(user.id, user.email);
  return { ...tokens, user: toPublicUser(user) };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userWithRole });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return toPublicUser(user);
}
