import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../../config/env.js";

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
}

function accessSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret());
}

export async function signAccessToken(input: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({
    email: input.email,
    role: input.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(env.jwtAccessTtl)
    .sign(accessSecretKey());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecretKey());
  if (!payload.sub || typeof payload.email !== "string" || typeof payload.role !== "string") {
    throw new Error("Invalid access token payload");
  }
  return payload as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + env.jwtRefreshTtlDays);
  return expires;
}
