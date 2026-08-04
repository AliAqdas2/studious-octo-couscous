import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { passwordResetCodes, users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  getGmailStatus,
  isGoogleOAuthConfigured,
} from "../gmail/gmailClient.js";
import { sendGmailEmail } from "../gmail/send.js";
import { hashPassword, revokeAllUserRefreshTokens } from "./authService.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function buildOtpEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FFF8F5; padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #f3e8e0;">
    <h1 style="margin:0 0 8px;color:#C84B31;font-size:24px;">Mangia CRM</h1>
    <p style="color:#444;font-size:15px;line-height:1.5;">Use this code to reset your password:</p>
    <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#111;text-align:center;margin:24px 0;">${code}</p>
    <p style="color:#666;font-size:14px;line-height:1.5;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="color:#999;font-size:13px;line-height:1.5;margin-top:24px;">If you did not request a password reset, you can ignore this email.</p>
  </div>
</body>
</html>`;
}

export async function isPasswordResetAvailable(): Promise<boolean> {
  try {
    if (!isGoogleOAuthConfigured()) return false;
    const status = await getGmailStatus();
    return status.connected;
  } catch {
    return false;
  }
}

export async function requestPasswordReset(input: {
  email: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ ok: true }> {
  if (!(await isPasswordResetAvailable())) {
    throw new AppError(
      "Password reset is unavailable. Gmail is not connected.",
      503
    );
  }

  const email = input.email.trim().toLowerCase();
  const db = requireDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return ok to avoid leaking whether the email exists.
  if (!user || !user.isActive || !user.passwordHash) {
    return { ok: true };
  }

  // Invalidate prior unconsumed codes for this user.
  await db
    .update(passwordResetCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.consumedAt)
      )
    );

  const code = generateOtp();
  const now = new Date();

  await db.insert(passwordResetCodes).values({
    userId: user.id,
    codeHash: hashCode(code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  try {
    await sendGmailEmail({
      to: user.email,
      subject: "Your Mangia CRM password reset code",
      body: buildOtpEmailHtml(code),
      html: true,
      userName: "System (Password Reset)",
    });
  } catch (err) {
    console.error(
      "[password-reset] Failed to send OTP email:",
      err instanceof Error ? err.message : err
    );
    throw new AppError(
      "Failed to send reset code. Please try again later.",
      502
    );
  }

  return { ok: true };
}

async function findActiveCodeForEmail(email: string) {
  const db = requireDb();
  const normalized = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!user || !user.isActive) {
    return { user: null, codeRow: null };
  }

  const [codeRow] = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.consumedAt)
      )
    )
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(1);

  return { user, codeRow: codeRow ?? null };
}

async function assertValidCode(email: string, code: string) {
  const db = requireDb();
  const { user, codeRow } = await findActiveCodeForEmail(email);

  if (!user || !codeRow) {
    throw new AppError("Invalid or expired code", 400);
  }

  if (codeRow.expiresAt.getTime() < Date.now()) {
    throw new AppError("Invalid or expired code", 400);
  }

  if (codeRow.attempts >= MAX_ATTEMPTS) {
    throw new AppError("Too many attempts. Request a new code.", 429);
  }

  const matches = codeRow.codeHash === hashCode(code.trim());
  if (!matches) {
    await db
      .update(passwordResetCodes)
      .set({ attempts: codeRow.attempts + 1 })
      .where(eq(passwordResetCodes.id, codeRow.id));

    if (codeRow.attempts + 1 >= MAX_ATTEMPTS) {
      throw new AppError("Too many attempts. Request a new code.", 429);
    }
    throw new AppError("Invalid or expired code", 400);
  }

  return { user, codeRow };
}

export async function verifyPasswordResetCode(input: {
  email: string;
  code: string;
}): Promise<{ valid: true }> {
  await assertValidCode(input.email, input.code);
  return { valid: true };
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ ok: true }> {
  if (
    !input.newPassword ||
    input.newPassword.length < MIN_PASSWORD_LENGTH
  ) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400
    );
  }

  const db = requireDb();
  const { user, codeRow } = await assertValidCode(input.email, input.code);

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  await db
    .update(users)
    .set({ passwordHash, updatedDate: now })
    .where(eq(users.id, user!.id));

  await db
    .update(passwordResetCodes)
    .set({ consumedAt: now })
    .where(eq(passwordResetCodes.id, codeRow!.id));

  await revokeAllUserRefreshTokens(user!.id);

  return { ok: true };
}
