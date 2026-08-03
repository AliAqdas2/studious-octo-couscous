import bcrypt from "bcrypt";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { refreshTokens, users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
  verifyAccessToken,
  type AccessTokenPayload,
} from "./tokenService.js";

const BCRYPT_COST = 12;
export const REFRESH_COOKIE_NAME = "refreshToken";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

function toAuthUser(row: {
  id: string;
  email: string;
  fullName: string;
  role: string;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function login(input: {
  email: string;
  password: string;
  userAgent?: string;
  ip?: string;
}): Promise<LoginResult> {
  const db = requireDb();
  const email = input.email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Account is deactivated", 403);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = refreshTokenExpiresAt();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedDate: new Date() })
    .where(eq(users.id, user.id));

  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user),
  };
}

export async function refresh(input: {
  refreshToken: string;
  userAgent?: string;
  ip?: string;
}): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
  const db = requireDb();
  const tokenHash = hashRefreshToken(input.refreshToken);

  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!existing) {
    throw new AppError("Invalid refresh token", 401);
  }

  if (existing.revokedAt) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.userId, existing.userId), isNull(refreshTokens.revokedAt))
      );
    throw new AppError("Refresh token reuse detected", 401);
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id));
    throw new AppError("Refresh token expired", 401);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, existing.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new AppError("User not found or inactive", 401);
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, existing.id));

  const newRefreshToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRefreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newHash,
    expiresAt: refreshTokenExpiresAt(),
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: toAuthUser(user),
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  const db = requireDb();
  const tokenHash = hashRefreshToken(refreshToken);

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}

export async function getUserFromAccessToken(
  token: string
): Promise<AuthUser & { isActive: boolean }> {
  let payload: AccessTokenPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }

  const db = requireDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user) {
    throw new AppError("User not found", 401);
  }

  if (!user.isActive) {
    throw new AppError("Account is deactivated", 403);
  }

  return {
    ...toAuthUser(user),
    isActive: user.isActive,
  };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const db = requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return toAuthUser(user);
}
