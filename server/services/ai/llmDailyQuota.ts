import { and, count, gte, lt, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { activityLogs } from "../../db/schema/index.js";
import { sendGmailEmail } from "../gmail/send.js";

const LOG = "[llm-daily-quota]";
export const LLM_DAILY_EMAIL_LIMIT = 50;
const ALERT_ACTION = "LLM Daily Quota Exceeded Alert";

function utcDayBounds(now = new Date()): { start: Date; end: Date; dayKey: string } {
  const dayKey = now.toISOString().slice(0, 10);
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(`${dayKey}T24:00:00.000Z`);
  return { start, end, dayKey };
}

/** Count activity logs today (UTC) that store LLM input_tokens. */
export async function countLlmEmailsTodayUtc(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const { start, end } = utcDayBounds();
  const [row] = await db
    .select({ value: count() })
    .from(activityLogs)
    .where(
      and(
        gte(activityLogs.timestamp, start),
        lt(activityLogs.timestamp, end),
        sql`${activityLogs.details} ? 'input_tokens'`
      )
    );
  return Number(row?.value ?? 0);
}

/**
 * After an intake LLM call completes (activity log with tokens may not be
 * written yet), check whether today's count + this call exceeds the limit.
 * Sends at most one alert email per UTC day to DEBUG_EMAIL_ADDRESS.
 */
export async function maybeAlertLlmDailyQuotaExceeded(opts?: {
  /** Count this call before its activity log row exists. Default true. */
  includePendingCall?: boolean;
}): Promise<{ count: number; alerted: boolean }> {
  const includePending = opts?.includePendingCall !== false;
  const to = env.debugEmailAddress();
  if (!to) {
    return { count: 0, alerted: false };
  }

  const db = getDb();
  if (!db) {
    return { count: 0, alerted: false };
  }

  const { start, end, dayKey } = utcDayBounds();
  const prior = await countLlmEmailsTodayUtc();
  const effective = prior + (includePending ? 1 : 0);

  if (effective <= LLM_DAILY_EMAIL_LIMIT) {
    return { count: effective, alerted: false };
  }

  const [already] = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.action, ALERT_ACTION),
        gte(activityLogs.timestamp, start),
        lt(activityLogs.timestamp, end)
      )
    )
    .limit(1);

  if (already) {
    return { count: effective, alerted: false };
  }

  try {
    await sendGmailEmail({
      to,
      subject: `LLM intake exceeded ${LLM_DAILY_EMAIL_LIMIT} emails today (${dayKey})`,
      body: [
        `Mangia CRM email intake has sent more than ${LLM_DAILY_EMAIL_LIMIT} emails to the LLM today (UTC).`,
        "",
        `Date (UTC): ${dayKey}`,
        `Count (including this call): ${effective}`,
        `Limit: ${LLM_DAILY_EMAIL_LIMIT}`,
        "",
        "Check AI Activity Log → Emails Sent to LLM for details.",
      ].join("\n"),
      userName: "System (LLM Quota)",
      systemAlert: true,
    });
  } catch (err) {
    console.error(
      `${LOG} Failed to send alert:`,
      err instanceof Error ? err.message : err
    );
    return { count: effective, alerted: false };
  }

  try {
    await db.insert(activityLogs).values({
      entityType: "Email",
      entityId: randomUUID(),
      action: ALERT_ACTION,
      details: {
        day_utc: dayKey,
        count: effective,
        limit: LLM_DAILY_EMAIL_LIMIT,
        debug_email: to,
      },
      userName: "System (LLM Quota)",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error(
      `${LOG} Failed to record alert activity:`,
      err instanceof Error ? err.message : err
    );
  }

  console.log(
    `${LOG} Alerted ${to}: LLM emails today=${effective} > ${LLM_DAILY_EMAIL_LIMIT}`
  );
  return { count: effective, alerted: true };
}
