import { sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, clients } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
]);

const ESTIMATE_KEYWORDS = [
  "estimate",
  "quote",
  "pricing",
  "cost",
  "how much",
  "price",
];

export type LeadChannel = "B2B" | "B2C";

export interface LeadEnrichInput {
  email?: string | null;
  company?: string | null;
  inquiryType?: string | null;
  clientId?: string | null;
  notes?: string | null;
  eventTypeInterest?: string | null;
  stage?: string | null;
  source?: string | null;
}

export interface LeadEnrichResult {
  channel: LeadChannel;
  clientId: string | null;
  isReturningClient: boolean;
  priorityTag: "Previous Client Priority" | "First Priority";
  isPriority: boolean;
  estimateKeywordsDetected: boolean;
  stage: string;
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

/** Pure channel rules — server source of truth (Base44 autoDetectLeadType). */
export function detectLeadChannel(input: {
  email?: string | null;
  company?: string | null;
  inquiryType?: string | null;
}): LeadChannel {
  const emailDomain = input.email?.split("@")[1]?.toLowerCase();
  const hasCompany = Boolean(input.company && input.company.trim() !== "");

  if (
    (emailDomain && !CONSUMER_DOMAINS.has(emailDomain)) ||
    hasCompany ||
    input.inquiryType === "Corporate Program"
  ) {
    return "B2B";
  }
  return "B2C";
}

/**
 * Synchronous create-time enrichment (no cron).
 * Always sets channel; may link returning client, priority, estimate flag, stage.
 * Does NOT jump to Survey Sent on estimate keywords — that happens after a real
 * survey draft is created (call-failure fallback).
 */
export async function enrichLeadOnCreate(
  input: LeadEnrichInput
): Promise<LeadEnrichResult> {
  const channel = detectLeadChannel({
    email: input.email,
    company: input.company,
    inquiryType: input.inquiryType,
  });

  let clientId = input.clientId || null;
  let isReturningClient = false;
  let priorityTag: "Previous Client Priority" | "First Priority" =
    "First Priority";

  if (input.email) {
    const db = requireDb();
    const emailLower = input.email.toLowerCase();
    const existingClients = await db
      .select()
      .from(clients)
      .where(sql`lower(${clients.email}) = ${emailLower}`)
      .limit(1);
    if (existingClients[0]) {
      clientId = existingClients[0].id;
      isReturningClient = true;
      priorityTag = "Previous Client Priority";
    }
  }

  const haystack =
    `${input.notes || ""} ${input.eventTypeInterest || ""}`.toLowerCase();
  const estimateKeywordsDetected = ESTIMATE_KEYWORDS.some((kw) =>
    haystack.includes(kw)
  );

  let stage = input.stage || "New Inquiry";
  if (stage === "New Inquiry" && input.source === "Call") {
    stage = "Initial Follow Up";
  }

  return {
    channel,
    clientId,
    isReturningClient,
    priorityTag,
    isPriority: isReturningClient,
    estimateKeywordsDetected,
    stage,
  };
}

/** Apply enrich fields onto a camelCase lead insert payload (mutates + returns). */
export function applyEnrichToLeadData(
  data: Record<string, unknown>,
  enrich: LeadEnrichResult
): Record<string, unknown> {
  data.channel = enrich.channel;
  data.clientId = enrich.clientId;
  data.isReturningClient = enrich.isReturningClient;
  data.priorityTag = enrich.priorityTag;
  data.isPriority = enrich.isPriority;
  data.estimateKeywordsDetected = enrich.estimateKeywordsDetected;
  data.stage = enrich.stage;
  return data;
}

export async function logAutoClassification(
  leadId: string,
  enrich: LeadEnrichResult
): Promise<void> {
  try {
    const db = requireDb();
    await db.insert(activityLogs).values({
      entityType: "Lead",
      entityId: leadId,
      action: "Auto-Classification",
      details: {
        channel: enrich.channel,
        priority_tag: enrich.priorityTag,
        is_returning: enrich.isReturningClient,
        estimate_detected: enrich.estimateKeywordsDetected,
        auto_stage: enrich.stage,
      },
      userName: "Lead Auto-Detection",
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn(
      "[enrichLeadOnCreate] Auto-Classification activity log failed:",
      err instanceof Error ? err.message : err
    );
  }
}
