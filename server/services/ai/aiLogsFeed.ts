import {
  and,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  callLogs,
  leads,
  spamEmails,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { toApiRecord } from "../entities/serialize.js";

const AI_USER_NAMES = [
  "System (Email Intake)",
  "System (Contact Form Watcher)",
  "Lead Auto-Detection",
  "Automated Call Fallback",
  "Staff Assignment System",
  "System",
  "system",
] as const;

const AI_ACTIONS = [
  "Auto-Classification",
  "Staff Auto-Assigned",
  "Meeting Proposal Draft Created (No-Answer Fallback)",
  "Created from Direct Email",
  "Created from Contact Form",
  "Inbound Email Received (Follow-up)",
  "Intake Failed (Dead Letter)",
  "Intake Failed (Retry Queued)",
] as const;

const BODY_SNIPPET_MAX = 200;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/** Cap how far we scan each source when merging (offset + limit). */
const MERGE_FETCH_CAP = 500;

export type AiLogsCategory =
  | "all"
  | "survey-draft"
  | "classification"
  | "lead-created"
  | "lead-appended"
  | "call"
  | "staff"
  | "event"
  | "spam-routed"
  | "intake-failure"
  | "other";

export interface AiLogsFeedQuery {
  limit?: number;
  offset?: number;
  category?: string;
  q?: string;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function aiActivityPredicate(): SQL {
  return or(
    inArray(activityLogs.action, [...AI_ACTIONS]),
    like(activityLogs.action, "Routed to Spam%"),
    inArray(activityLogs.userName, [...AI_USER_NAMES])
  )!;
}

function categoryActivityPredicate(category: string): SQL | null {
  switch (category) {
    case "survey-draft":
      return like(activityLogs.action, "%Meeting Proposal Draft%");
    case "classification":
      return eq(activityLogs.action, "Auto-Classification");
    case "lead-created":
      return or(
        eq(activityLogs.action, "Created from Direct Email"),
        eq(activityLogs.action, "Created from Contact Form")
      )!;
    case "lead-appended":
      return eq(activityLogs.action, "Inbound Email Received (Follow-up)");
    case "staff":
      return eq(activityLogs.action, "Staff Auto-Assigned");
    case "event":
      return or(
        eq(activityLogs.action, "Event Created"),
        eq(activityLogs.action, "Created from Won Lead")
      )!;
    case "spam-routed":
      return like(activityLogs.action, "Routed to Spam%");
    case "intake-failure":
      return or(
        eq(activityLogs.action, "Intake Failed (Dead Letter)"),
        eq(activityLogs.action, "Intake Failed (Retry Queued)")
      )!;
    case "call":
      return null;
    case "other":
      return null;
    default:
      return null;
  }
}

function actionToCategory(action: string | null | undefined): AiLogsCategory {
  if (action?.includes("Meeting Proposal Draft")) return "survey-draft";
  if (action === "Auto-Classification") return "classification";
  if (action === "Staff Auto-Assigned") return "staff";
  if (
    action === "Created from Direct Email" ||
    action === "Created from Contact Form"
  ) {
    return "lead-created";
  }
  if (action === "Inbound Email Received (Follow-up)") return "lead-appended";
  if (action === "Event Created" || action === "Created from Won Lead") {
    return "event";
  }
  if (action === "Call Analyzed") return "call";
  if (action?.startsWith("Routed to Spam")) return "spam-routed";
  if (
    action === "Intake Failed (Dead Letter)" ||
    action === "Intake Failed (Retry Queued)"
  ) {
    return "intake-failure";
  }
  return "other";
}

function truncateDetails(
  details: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!details || typeof details !== "object") return {};
  const out: Record<string, unknown> = { ...details };
  const snippet = out.body_snippet;
  if (typeof snippet === "string" && snippet.length > BODY_SNIPPET_MAX) {
    out.body_snippet = `${snippet.slice(0, BODY_SNIPPET_MAX)}…`;
  }
  return out;
}

function searchHaystack(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function matchesSearch(
  q: string,
  haystack: string
): boolean {
  if (!q) return true;
  return haystack.includes(q.toLowerCase());
}

export async function getAiLogsFeed(query: AiLogsFeedQuery) {
  const db = requireDb();
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const offset = Math.max(Number(query.offset) || 0, 0);
  const category = (query.category || "all").trim() || "all";
  const q = (query.q || "").trim();

  const includeActivity = category !== "call";
  const includeCalls = category === "all" || category === "call";
  const fetchN = Math.min(offset + limit, MERGE_FETCH_CAP);

  type FeedRow = {
    id: string;
    _source: "activity" | "call";
    entity_type: string;
    entity_id: string;
    action: string;
    user_name: string | null;
    timestamp: string | null;
    details: Record<string, unknown>;
    lead?: Record<string, unknown> | null;
    spam?: Record<string, unknown> | null;
  };

  const merged: FeedRow[] = [];

  if (includeActivity) {
    const predicates: SQL[] = [aiActivityPredicate()];
    const catPred = categoryActivityPredicate(category);
    if (catPred) predicates.push(catPred);
    if (q) {
      predicates.push(
        or(
          like(activityLogs.action, `%${q}%`),
          like(activityLogs.userName, `%${q}%`),
          sql`(${activityLogs.details})::text ILIKE ${`%${q}%`}`
        )!
      );
    }

    const rows = await db
      .select({
        id: activityLogs.id,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        action: activityLogs.action,
        userName: activityLogs.userName,
        timestamp: activityLogs.timestamp,
        details: activityLogs.details,
      })
      .from(activityLogs)
      .where(and(...predicates))
      .orderBy(desc(activityLogs.timestamp))
      .limit(fetchN);

    for (const row of rows) {
      merged.push({
        id: row.id,
        _source: "activity",
        entity_type: row.entityType,
        entity_id: row.entityId,
        action: row.action,
        user_name: row.userName,
        timestamp: row.timestamp ? row.timestamp.toISOString() : null,
        details: truncateDetails(
          (row.details as Record<string, unknown>) || {}
        ),
      });
    }
  }

  if (includeCalls) {
    const callPreds: SQL[] = [eq(callLogs.status, "Analyzed")];
    if (q) {
      callPreds.push(
        or(
          like(callLogs.leadName, `%${q}%`),
          like(callLogs.summary, `%${q}%`),
          like(callLogs.leadCompany, `%${q}%`)
        )!
      );
    }

    const rows = await db
      .select({
        id: callLogs.id,
        leadId: callLogs.leadId,
        leadName: callLogs.leadName,
        endedAt: callLogs.endedAt,
        startedAt: callLogs.startedAt,
        summary: callLogs.summary,
        extractedNextStage: callLogs.extractedNextStage,
        extractedBudget: callLogs.extractedBudget,
        extractedHeadcount: callLogs.extractedHeadcount,
        extractedTiming: callLogs.extractedTiming,
        recordingUrl: callLogs.recordingUrl,
      })
      .from(callLogs)
      .where(and(...callPreds))
      .orderBy(desc(callLogs.endedAt))
      .limit(fetchN);

    for (const c of rows) {
      const ts = c.endedAt || c.startedAt;
      merged.push({
        id: `call-${c.id}`,
        _source: "call",
        entity_type: "Lead",
        entity_id: c.leadId,
        action: "Call Analyzed",
        user_name: "AI Call Analyzer",
        timestamp: ts ? ts.toISOString() : null,
        details: {
          call_log_id: c.id,
          summary: c.summary,
          extracted_next_stage: c.extractedNextStage,
          extracted_budget: c.extractedBudget,
          extracted_headcount: c.extractedHeadcount,
          extracted_timing: c.extractedTiming,
          recording_url: c.recordingUrl,
          lead_name: c.leadName,
        },
      });
    }
  }

  merged.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });

  // Client-side category "other" / refine search on lead fields after embed
  let filtered = merged;
  if (category === "other") {
    filtered = merged.filter((r) => actionToCategory(r.action) === "other");
  }

  const page = filtered.slice(offset, offset + limit);

  // Batch lead + spam embeds for this page only
  const leadIds = [
    ...new Set(
      page
        .filter((r) => r.entity_type === "Lead" && r.entity_id)
        .map((r) => r.entity_id)
    ),
  ];
  const spamIds = [
    ...new Set(
      page
        .map((r) => {
          const id = r.details?.spam_email_id;
          return typeof id === "string" ? id : null;
        })
        .filter((id): id is string => !!id)
    ),
  ];

  const leadById = new Map<string, Record<string, unknown>>();
  if (leadIds.length > 0) {
    const leadRows = await db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        company: leads.company,
        gmailThreadId: leads.gmailThreadId,
      })
      .from(leads)
      .where(inArray(leads.id, leadIds));
    for (const row of leadRows) {
      leadById.set(row.id, toApiRecord(row as Record<string, unknown>));
    }
  }

  const spamById = new Map<string, Record<string, unknown>>();
  if (spamIds.length > 0) {
    const spamRows = await db
      .select({
        id: spamEmails.id,
        gmailMessageId: spamEmails.gmailMessageId,
        subject: spamEmails.subject,
        from: spamEmails.from,
      })
      .from(spamEmails)
      .where(inArray(spamEmails.id, spamIds));
    for (const row of spamRows) {
      spamById.set(row.id, toApiRecord(row as Record<string, unknown>));
    }
  }

  const data = page
    .map((row) => {
      const lead = leadById.get(row.entity_id) || null;
      const spamId =
        typeof row.details?.spam_email_id === "string"
          ? row.details.spam_email_id
          : null;
      const spam = spamId ? spamById.get(spamId) || null : null;

      // Refine search against lead fields when q present (SQL already filtered loosely)
      if (q) {
        const hay = searchHaystack([
          row.action,
          row.user_name,
          lead?.name as string | undefined,
          lead?.email as string | undefined,
          lead?.company as string | undefined,
          row.details?.summary as string | undefined,
          row.details?.subject as string | undefined,
          row.details?.recipient as string | undefined,
          row.details?.ai_reason as string | undefined,
          row.details?.from as string | undefined,
        ]);
        if (!matchesSearch(q, hay)) return null;
      }

      return {
        ...row,
        lead,
        spam,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  // Totals (filtered subset, not full table)
  let total = 0;
  if (includeActivity) {
    const predicates: SQL[] = [aiActivityPredicate()];
    const catPred = categoryActivityPredicate(category);
    if (catPred) predicates.push(catPred);
    if (q) {
      predicates.push(
        or(
          like(activityLogs.action, `%${q}%`),
          like(activityLogs.userName, `%${q}%`),
          sql`(${activityLogs.details})::text ILIKE ${`%${q}%`}`
        )!
      );
    }
    const [{ value }] = await db
      .select({ value: count() })
      .from(activityLogs)
      .where(and(...predicates));
    total += Number(value) || 0;
  }
  if (includeCalls) {
    const callPreds: SQL[] = [eq(callLogs.status, "Analyzed")];
    if (q) {
      callPreds.push(
        or(
          like(callLogs.leadName, `%${q}%`),
          like(callLogs.summary, `%${q}%`),
          like(callLogs.leadCompany, `%${q}%`)
        )!
      );
    }
    const [{ value }] = await db
      .select({ value: count() })
      .from(callLogs)
      .where(and(...callPreds));
    total += Number(value) || 0;
  }

  return { data, total, limit, offset };
}

export async function getAiLogsStats() {
  const db = requireDb();

  // Category counts for summary chips
  const activityRows = await db
    .select({
      action: activityLogs.action,
      cnt: count(),
    })
    .from(activityLogs)
    .where(aiActivityPredicate())
    .groupBy(activityLogs.action);

  const counts: Record<string, number> = { total: 0 };
  for (const row of activityRows) {
    const cat = actionToCategory(row.action);
    const n = Number(row.cnt) || 0;
    counts[cat] = (counts[cat] || 0) + n;
    counts.total += n;
  }

  const [{ value: callCount }] = await db
    .select({ value: count() })
    .from(callLogs)
    .where(eq(callLogs.status, "Analyzed"));
  const calls = Number(callCount) || 0;
  counts.call = (counts.call || 0) + calls;
  counts.total += calls;

  // 30-day daily LLM token aggregates from activity details
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);

  const llmRows = await db
    .select({
      timestamp: activityLogs.timestamp,
      action: activityLogs.action,
      details: activityLogs.details,
    })
    .from(activityLogs)
    .where(
      and(
        aiActivityPredicate(),
        sql`${activityLogs.timestamp} >= ${since}`,
        sql`((${activityLogs.details}->>'input_tokens') IS NOT NULL OR (${activityLogs.details}->>'output_tokens') IS NOT NULL)`
      )
    );

  const byDay: Record<
    string,
    {
      date: string;
      total: number;
      leads: number;
      spam: number;
      followups: number;
      inputTokens: number;
      outputTokens: number;
      tokens: number;
    }
  > = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = {
      date: key,
      total: 0,
      leads: 0,
      spam: 0,
      followups: 0,
      inputTokens: 0,
      outputTokens: 0,
      tokens: 0,
    };
  }

  for (const row of llmRows) {
    const key = row.timestamp ? row.timestamp.toISOString().slice(0, 10) : "";
    if (!byDay[key]) continue;
    const details = (row.details || {}) as Record<string, unknown>;
    byDay[key].total++;
    if (
      row.action === "Created from Contact Form" ||
      row.action === "Created from Direct Email"
    ) {
      byDay[key].leads++;
    } else if (row.action === "Inbound Email Received (Follow-up)") {
      byDay[key].followups++;
    } else {
      byDay[key].spam++;
    }
    const inT = Number(details.input_tokens) || 0;
    const outT = Number(details.output_tokens) || 0;
    const totalT = Number(details.total_tokens) || inT + outT;
    byDay[key].inputTokens += inT;
    byDay[key].outputTokens += outT;
    byDay[key].tokens += totalT;
  }

  const daily = Object.values(byDay).map((d) => ({
    ...d,
    label: new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const totals = daily.reduce(
    (acc, d) => {
      acc.emails += d.total;
      acc.tokens += d.tokens;
      acc.inputTokens += d.inputTokens;
      acc.outputTokens += d.outputTokens;
      return acc;
    },
    { emails: 0, tokens: 0, inputTokens: 0, outputTokens: 0 }
  );

  return { counts, daily, totals };
}
