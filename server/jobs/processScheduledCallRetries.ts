import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { callLogs } from "../db/schema/index.js";
import { triggerCall } from "../services/twilio/triggerCall.js";

const SPACING_MS = 30 * 1000;

export interface ProcessRetryResult {
  call_log_id: string;
  lead_id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Drain CallLogs whose scheduled_retry_at is due.
 * Marks each row processed first (idempotent), then re-invokes triggerCall.
 */
export async function processScheduledCallRetries(): Promise<{
  success: boolean;
  processed: number;
  spacing_seconds: number;
  results: ProcessRetryResult[];
}> {
  const db = getDb();
  if (!db) {
    console.warn("[processScheduledCallRetries] Database not configured — skipping");
    return {
      success: false,
      processed: 0,
      spacing_seconds: SPACING_MS / 1000,
      results: [],
    };
  }

  const now = new Date();
  const due = await db
    .select()
    .from(callLogs)
    .where(
      and(
        eq(callLogs.retryProcessed, false),
        isNotNull(callLogs.scheduledRetryAt),
        lte(callLogs.scheduledRetryAt, now)
      )
    )
    .orderBy(asc(callLogs.scheduledRetryAt));

  const results: ProcessRetryResult[] = [];

  for (let i = 0; i < due.length; i++) {
    const cl = due[i];
    if (!cl.scheduledRetryAt || !cl.leadId) continue;

    // Mark processed FIRST so we never double-trigger
    await db
      .update(callLogs)
      .set({
        retryProcessed: true,
        scheduledRetryAt: null,
        updatedDate: new Date(),
      })
      .where(eq(callLogs.id, cl.id));

    try {
      const data = await triggerCall({ leadId: cl.leadId });
      results.push({
        call_log_id: cl.id,
        lead_id: cl.leadId,
        ok: true,
        data,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[processScheduledCallRetries] Failed lead=${cl.leadId} callLog=${cl.id}:`,
        message
      );
      results.push({
        call_log_id: cl.id,
        lead_id: cl.leadId,
        ok: false,
        error: message,
      });
    }

    if (i < due.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, SPACING_MS));
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(
    `[processScheduledCallRetries] processed=${results.length} ok=${okCount} fail=${results.length - okCount}`
  );

  return {
    success: true,
    processed: results.length,
    spacing_seconds: SPACING_MS / 1000,
    results,
  };
}
