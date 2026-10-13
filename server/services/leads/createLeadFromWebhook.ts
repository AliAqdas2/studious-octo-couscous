import { and, eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { createEntity } from "../entities/entityService.js";

const LEAD_SOURCES = new Set([
  "Website",
  "Email",
  "Phone",
  "Referral",
  "Call",
  "Form",
  "Other",
]);

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("JSON body required", 400);
  }
  return body as Record<string, unknown>;
}

function pickString(
  data: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return String(raw);
    }
  }
  return undefined;
}

function pickBool(
  data: Record<string, unknown>,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "boolean") return raw;
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
  }
  return undefined;
}

function pickNumber(
  data: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const n = Number(raw.trim());
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resolveWebhookActor(): Promise<AuthUser> {
  const db = requireDb();
  const seedEmail = env.seedAdminEmail.toLowerCase();

  const [seedAdmin] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, seedEmail), eq(users.isActive, true)))
    .limit(1);

  if (seedAdmin) {
    return {
      id: seedAdmin.id,
      email: seedAdmin.email,
      full_name: seedAdmin.fullName,
      role: seedAdmin.role,
    };
  }

  const [admin] = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
    .limit(1);

  if (admin) {
    return {
      id: admin.id,
      email: admin.email,
      full_name: admin.fullName,
      role: admin.role,
    };
  }

  throw new AppError(
    "No active admin user available to attribute webhook leads",
    503
  );
}

export interface CreateLeadFromWebhookResult {
  ok: true;
  id: string;
  crm_url: string;
}

/**
 * Normalize an inbound webhook payload and create a lead via createEntity
 * so enrich + scheduleOnLeadCreated (auto-call) run unchanged.
 */
export async function createLeadFromWebhook(
  rawBody: unknown
): Promise<CreateLeadFromWebhookResult> {
  const data = asRecord(rawBody);

  const name = pickString(data, "name", "contact_name", "contactName");
  const email = pickString(data, "email", "contact_email", "contactEmail");

  if (!name) {
    throw new AppError("name is required", 400);
  }
  if (!email) {
    throw new AppError("email is required", 400);
  }
  if (!isValidEmail(email)) {
    throw new AppError("email is invalid", 400);
  }

  const sourceRaw = pickString(data, "source") || "Form";
  if (!LEAD_SOURCES.has(sourceRaw)) {
    throw new AppError(
      `source must be one of: ${[...LEAD_SOURCES].join(", ")}`,
      400
    );
  }

  const headcount = pickNumber(
    data,
    "headcount_estimate",
    "headcountEstimate",
    "guest_count",
    "guestCount"
  );
  const preferredDate = pickString(
    data,
    "preferred_date",
    "preferredDate",
    "event_date",
    "eventDate"
  );
  const skipAutoCall = pickBool(data, "skip_auto_call", "skipAutoCall");

  const body: Record<string, unknown> = {
    name,
    email: email.toLowerCase(),
    source: sourceRaw,
    stage: "New Inquiry",
  };

  const phone = pickString(data, "phone");
  if (phone) body.phone = phone;

  const company = pickString(data, "company");
  if (company) body.company = company;

  const title = pickString(data, "title");
  if (title) body.title = title;

  const notes = pickString(data, "notes");
  if (notes) body.notes = notes;

  const eventType = pickString(
    data,
    "event_type",
    "eventType",
    "event_type_interest",
    "eventTypeInterest"
  );
  if (eventType) body.event_type_interest = eventType;

  if (headcount !== undefined) body.headcount_estimate = headcount;
  if (preferredDate) body.preferred_date = preferredDate;

  const inquiryType = pickString(data, "inquiry_type", "inquiryType");
  if (inquiryType) body.inquiry_type = inquiryType;

  const referralSource = pickString(data, "referral_source", "referralSource");
  if (referralSource) body.referral_source = referralSource;

  if (skipAutoCall !== undefined) body.skip_auto_call = skipAutoCall;

  const actor = await resolveWebhookActor();
  const record = await createEntity("leads", body, actor);
  const id = typeof record.id === "string" ? record.id : "";
  if (!id) {
    throw new AppError("Lead create failed", 500);
  }

  const base = env.appUrl().replace(/\/$/, "");
  return {
    ok: true,
    id,
    crm_url: `${base}/Leads?id=${encodeURIComponent(id)}`,
  };
}
