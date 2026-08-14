import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { roleAssignments, users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  getGmailStatus,
  isGoogleOAuthConfigured,
} from "../gmail/gmailClient.js";
import { sendGmailEmail } from "../gmail/send.js";
import { hashPassword } from "./authService.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

const OPERATIONAL_ROLES = [
  "Admin",
  "Sales",
  "Ops",
  "Chef",
  "Event Host",
  "Finance",
  "Instructor",
  "Onboarding",
] as const;

export type OperationalRole = (typeof OPERATIONAL_ROLES)[number];
export type AppRole = "admin" | "user";

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

function isOperationalRole(value: string): value is OperationalRole {
  return (OPERATIONAL_ROLES as readonly string[]).includes(value);
}

function buildInviteEmailHtml(params: {
  fullName: string;
  inviteUrl: string;
}): string {
  const name = params.fullName.replace(/</g, "&lt;");
  const url = params.inviteUrl.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#FFF8F5; padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #f3e8e0;">
    <h1 style="margin:0 0 8px;color:#C84B31;font-size:24px;">Mangia CRM</h1>
    <p style="color:#444;font-size:15px;line-height:1.5;">Hi ${name},</p>
    <p style="color:#444;font-size:15px;line-height:1.5;">You've been invited to Mangia CRM. Click the button below to set your password and activate your account.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:#C84B31;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Accept invite</a>
    </p>
    <p style="color:#666;font-size:13px;line-height:1.5;">This link expires in <strong>7 days</strong>.</p>
    <p style="color:#999;font-size:12px;line-height:1.5;word-break:break-all;margin-top:16px;">${url}</p>
  </div>
</body>
</html>`;
}

async function trySendInviteEmail(params: {
  to: string;
  fullName: string;
  inviteUrl: string;
}): Promise<boolean> {
  try {
    if (!isGoogleOAuthConfigured()) return false;
    const status = await getGmailStatus();
    if (!status.connected) return false;
    await sendGmailEmail({
      to: params.to,
      subject: "You're invited to Mangia CRM",
      body: buildInviteEmailHtml({
        fullName: params.fullName,
        inviteUrl: params.inviteUrl,
      }),
      html: true,
      userName: "System (User Invite)",
      systemAlert: true,
    });
    return true;
  } catch (err) {
    console.warn(
      "[invite] Failed to email invite:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

function publicUser(row: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  isActive: boolean;
}) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.fullName,
    role: row.role,
    phone: row.phone,
    is_active: row.isActive,
  };
}

async function upsertRoleAssignment(params: {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  operationalRole: OperationalRole;
}): Promise<void> {
  const db = requireDb();
  const now = new Date();

  const existing = await db
    .select()
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, params.userId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(roleAssignments)
      .set({
        role: params.operationalRole,
        userEmail: params.email,
        userName: params.fullName,
        contactName: params.fullName,
        contactEmail: params.email,
        contactPhone: params.phone,
        isActive: true,
        updatedDate: now,
      })
      .where(eq(roleAssignments.id, existing[0].id));
    return;
  }

  // Also match a contact-only row by email so we don't leave duplicates.
  const byEmail = await db
    .select()
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.contactEmail, params.email),
        isNull(roleAssignments.userId)
      )
    )
    .limit(1);

  if (byEmail[0]) {
    await db
      .update(roleAssignments)
      .set({
        userId: params.userId,
        role: params.operationalRole,
        userEmail: params.email,
        userName: params.fullName,
        contactName: params.fullName,
        contactEmail: params.email,
        contactPhone: params.phone,
        isActive: true,
        updatedDate: now,
      })
      .where(eq(roleAssignments.id, byEmail[0].id));
    return;
  }

  await db.insert(roleAssignments).values({
    userId: params.userId,
    userEmail: params.email,
    userName: params.fullName,
    role: params.operationalRole,
    contactName: params.fullName,
    contactEmail: params.email,
    contactPhone: params.phone,
    isActive: true,
  });
}

export async function inviteUser(input: {
  email: string;
  full_name: string;
  phone?: string | null;
  role: AppRole;
  operational_role: string;
}): Promise<{
  user: ReturnType<typeof publicUser>;
  inviteUrl: string;
  emailSent: boolean;
}> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim();
  const phone = input.phone?.trim() || null;
  const appRole: AppRole = input.role === "admin" ? "admin" : "user";

  if (!fullName) {
    throw new AppError("Name is required", 400);
  }
  if (!email) {
    throw new AppError("Email is required", 400);
  }
  if (!isOperationalRole(input.operational_role)) {
    throw new AppError("Invalid operational role", 400);
  }

  const db = requireDb();
  const rawToken = generateInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userRow: typeof users.$inferSelect;

  if (existing) {
    if (existing.passwordHash) {
      throw new AppError(
        "A user with this email already has an account",
        409
      );
    }
    const [updated] = await db
      .update(users)
      .set({
        fullName,
        phone,
        role: appRole,
        isActive: true,
        inviteToken: tokenHash,
        inviteExpiresAt: expiresAt,
        updatedDate: now,
      })
      .where(eq(users.id, existing.id))
      .returning();
    if (!updated) {
      throw new AppError("Failed to update invite", 500);
    }
    userRow = updated;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        fullName,
        phone,
        role: appRole,
        isActive: true,
        passwordHash: null,
        inviteToken: tokenHash,
        inviteExpiresAt: expiresAt,
      })
      .returning();
    if (!created) {
      throw new AppError("Failed to create user", 500);
    }
    userRow = created;
  }

  await upsertRoleAssignment({
    userId: userRow.id,
    email,
    fullName,
    phone,
    operationalRole: input.operational_role,
  });

  const appUrl = env.appUrl().replace(/\/$/, "");
  const inviteUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(rawToken)}`;

  const emailSent = await trySendInviteEmail({
    to: email,
    fullName,
    inviteUrl,
  });

  return {
    user: publicUser(userRow),
    inviteUrl,
    emailSent,
  };
}

async function findUserByInviteToken(rawToken: string) {
  const token = rawToken.trim();
  if (!token) {
    throw new AppError("Invite token is required", 400);
  }
  const db = requireDb();
  const tokenHash = hashToken(token);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.inviteToken, tokenHash))
    .limit(1);
  return user ?? null;
}

export async function getInviteStatus(rawToken: string): Promise<{
  valid: boolean;
  email?: string;
  full_name?: string;
  reason?: string;
}> {
  const user = await findUserByInviteToken(rawToken);
  if (!user) {
    return { valid: false, reason: "Invalid invite link" };
  }
  if (user.passwordHash) {
    return { valid: false, reason: "Invite already accepted" };
  }
  if (!user.isActive) {
    return { valid: false, reason: "Account is deactivated" };
  }
  if (
    !user.inviteExpiresAt ||
    new Date(user.inviteExpiresAt).getTime() < Date.now()
  ) {
    return { valid: false, reason: "Invite link has expired" };
  }
  return {
    valid: true,
    email: user.email,
    full_name: user.fullName,
  };
}

export async function acceptInvite(input: {
  token: string;
  password: string;
}): Promise<{ ok: true }> {
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400
    );
  }

  const user = await findUserByInviteToken(input.token);
  if (!user) {
    throw new AppError("Invalid or expired invite link", 400);
  }
  if (user.passwordHash) {
    throw new AppError("Invite already accepted", 400);
  }
  if (!user.isActive) {
    throw new AppError("Account is deactivated", 403);
  }
  if (
    !user.inviteExpiresAt ||
    new Date(user.inviteExpiresAt).getTime() < Date.now()
  ) {
    throw new AppError("Invite link has expired", 400);
  }

  const db = requireDb();
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  await db
    .update(users)
    .set({
      passwordHash,
      inviteToken: null,
      inviteExpiresAt: null,
      updatedDate: now,
    })
    .where(eq(users.id, user.id));

  return { ok: true };
}
