import { randomUUID } from "crypto";
import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  gmailIntakeDeadLetters,
  gmailIntakeRetries,
  gmailPollState,
  processedGmailMessages,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { sendGmailEmail } from "./send.js";
import { getGmailApi } from "./gmailClient.js";
import {
  decodeGmailBody,
  getHeader,
} from "./inboundFilters.js";

const LOG = "[gmail-intake-dead-letter]";

/** Max re-attempts after the first failure (3 total tries). */
export const MAX_INTAKE_RETRIES = 2;

const RETRY_BACKOFF_MS = [2 * 60_000, 10 * 60_000];
/** Global coalesced alert window — at most one dead-letter email per period. */
const ALERT_DEDUP_MS = 12 * 60 * 60 * 1000;

export type IntakeSource = "webhook" | "poller";

export const TERMINAL_PROCESSED_STATUSES = new Set([
  "lead",
  "spam",
  "ignored",
  "failed",
]);

/** Errors that will never succeed on retry (config / missing resources). */
export function isPermanentIntakeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("AI is not configured") ||
    msg.includes("ANTHROPIC_API_KEY") ||
    msg.includes("Database is not configured")
  );
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function truncateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 2000);
}

function nextRetryAt(attemptCount: number): Date {
  const idx = Math.min(Math.max(attemptCount - 1, 0), RETRY_BACKOFF_MS.length - 1);
  return new Date(Date.now() + RETRY_BACKOFF_MS[idx]!);
}

async function fetchMessageSnapshot(messageId: string): Promise<{
  from: string;
  subject: string;
  body: string;
  threadId: string | null;
  snippet: string;
} | null> {
  try {
    const gmail = await getGmailApi();
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    const message = res.data;
    const headers = message.payload?.headers || [];
    const body =
      decodeGmailBody(message.payload || null) || message.snippet || "";
    return {
      from: getHeader(headers, "From"),
      subject: getHeader(headers, "Subject") || "(No Subject)",
      body: body.slice(0, 100_000),
      threadId: message.threadId || null,
      snippet: message.snippet || "",
    };
  } catch {
    return null;
  }
}

async function logIntakeFailureActivity(params: {
  messageId: string;
  /** Must be a UUID — activity_logs.entity_id is uuid-typed. */
  entityId: string;
  source: IntakeSource;
  error: string;
  stage: "retry_queued" | "dead_letter";
  attemptCount: number;
  snapshot?: {
    from?: string | null;
    subject?: string | null;
    body?: string | null;
    threadId?: string | null;
    snippet?: string | null;
  } | null;
}): Promise<void> {
  try {
    const db = requireDb();
    const action =
      params.stage === "dead_letter"
        ? "Intake Failed (Dead Letter)"
        : "Intake Failed (Retry Queued)";
    const bodySnippet = (params.snapshot?.body || params.snapshot?.snippet || "")
      .toString()
      .slice(0, 2000);

    await db.insert(activityLogs).values({
      entityType: "Email",
      entityId: params.entityId,
      action,
      details: {
        gmail_message_id: params.messageId,
        gmail_thread_id: params.snapshot?.threadId || null,
        from: params.snapshot?.from || null,
        subject: params.snapshot?.subject || null,
        body_snippet: bodySnippet,
        error: params.error,
        attempt_count: params.attemptCount,
        source: params.source,
        stage: params.stage,
        ...(params.stage === "dead_letter"
          ? { dead_letter_id: params.entityId }
          : {}),
      },
      userName: "System (Email Intake)",
      timestamp: new Date(),
    });
  } catch (e) {
    console.warn(
      `${LOG} ActivityLog insert failed:`,
      e instanceof Error ? e.message : e
    );
  }
}

async function recordFailedProcessed(
  messageId: string,
  source: IntakeSource
): Promise<void> {
  const db = requireDb();
  try {
    await db.insert(processedGmailMessages).values({
      gmailMessageId: messageId,
      processedAt: new Date(),
      source,
      status: "failed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      console.warn(`${LOG} recordFailedProcessed(${messageId}) failed:`, msg);
    }
  }
}

async function sendDeadLetterAlert(params: {
  messageId: string;
  from: string;
  subject: string;
  lastError: string;
  attemptCount: number;
}): Promise<void> {
  const db = requireDb();
  const now = new Date();
  const errorSnippet = params.lastError.slice(0, 2000);
  const alertCutoff = new Date(now.getTime() - ALERT_DEDUP_MS);

  // Ensure poll-state row exists, then always refresh latest error.
  const pollRows = await db
    .select()
    .from(gmailPollState)
    .where(eq(gmailPollState.key, "default"))
    .limit(1);

  if (!pollRows[0]) {
    try {
      await db.insert(gmailPollState).values({
        key: "default",
        lastDeadLetterError: errorSnippet,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate") && !msg.includes("unique")) {
        throw e;
      }
    }
  } else {
    await db
      .update(gmailPollState)
      .set({
        lastDeadLetterError: errorSnippet,
        updatedDate: now,
      })
      .where(eq(gmailPollState.id, pollRows[0].id));
  }

  // Atomic claim: only one sender wins the 12h window.
  const claimed = await db
    .update(gmailPollState)
    .set({
      deadLetterAlertSentAt: now,
      lastDeadLetterError: errorSnippet,
      updatedDate: now,
    })
    .where(
      and(
        eq(gmailPollState.key, "default"),
        or(
          isNull(gmailPollState.deadLetterAlertSentAt),
          lt(gmailPollState.deadLetterAlertSentAt, alertCutoff)
        )
      )
    )
    .returning({ id: gmailPollState.id });

  if (claimed.length === 0) {
    console.warn(
      `${LOG} Suppressing dead-letter alert (already sent within 12h): ${params.messageId}`
    );
    return;
  }

  const to = env.digestRecipients()[0];
  if (!to) {
    console.error(`${LOG} No digest recipient configured; skipping alert email`);
    return;
  }

  const appUrl = env.appUrl().replace(/\/$/, "");
  const subject = "Mangia CRM: Gmail intake failing";
  const body = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;">
  <h2 style="color:#C84B31;">Gmail intake failing</h2>
  <p>Inbound email processing is failing. Messages are being moved to dead-letter for recovery.</p>
  <p><strong>Latest error:</strong> ${params.lastError.replace(/</g, "&lt;")}</p>
  <ul>
    <li><strong>Example message ID:</strong> ${params.messageId}</li>
    <li><strong>From:</strong> ${params.from.replace(/</g, "&lt;")}</li>
    <li><strong>Subject:</strong> ${params.subject.replace(/</g, "&lt;")}</li>
    <li><strong>Attempts:</strong> ${params.attemptCount}</li>
  </ul>
  <p>If this mentions <code>ANTHROPIC_API_KEY</code> or AI is not configured, set the key and restart. Full bodies are in <code>gmail_intake_dead_letters</code>.</p>
  <p>Review at <a href="${appUrl}">${appUrl}</a></p>
  <p style="color:#888;font-size:13px;">This alert is sent at most once every 12 hours while intake keeps failing. Further failed messages will not send additional emails.</p>
</body></html>`;

  try {
    await sendGmailEmail({
      to,
      subject,
      body,
      html: true,
      userName: "System (Gmail Intake)",
      systemAlert: true,
    });
  } catch (sendErr) {
    console.error(
      `${LOG} Failed to send alert to ${to}:`,
      sendErr instanceof Error ? sendErr.message : sendErr
    );
  }

  await db
    .update(gmailIntakeDeadLetters)
    .set({ alertSentAt: now, updatedDate: now })
    .where(eq(gmailIntakeDeadLetters.gmailMessageId, params.messageId));
}

export async function moveToDeadLetter(params: {
  messageId: string;
  source: IntakeSource;
  error: unknown;
  attemptCount: number;
}): Promise<void> {
  const db = requireDb();
  const lastError = truncateError(params.error);
  const snapshot = await fetchMessageSnapshot(params.messageId);
  const now = new Date();

  console.error(
    `${LOG} CRITICAL: message ${params.messageId} moved to dead-letter after ${params.attemptCount} failure(s): ${lastError}`
  );

  let deadLetterId: string | null = null;
  try {
    const [row] = await db
      .insert(gmailIntakeDeadLetters)
      .values({
        gmailMessageId: params.messageId,
        from: snapshot?.from || null,
        subject: snapshot?.subject || null,
        body: snapshot?.body || null,
        threadId: snapshot?.threadId || null,
        snippet: snapshot?.snippet || null,
        attemptCount: params.attemptCount,
        lastError,
        source: params.source,
        failedAt: now,
      })
      .returning({ id: gmailIntakeDeadLetters.id });
    deadLetterId = row?.id ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      console.error(`${LOG} insert dead-letter failed:`, msg);
    } else {
      const existing = await db
        .select({ id: gmailIntakeDeadLetters.id })
        .from(gmailIntakeDeadLetters)
        .where(eq(gmailIntakeDeadLetters.gmailMessageId, params.messageId))
        .limit(1);
      deadLetterId = existing[0]?.id ?? null;
    }
  }

  await recordFailedProcessed(params.messageId, params.source);

  await db
    .delete(gmailIntakeRetries)
    .where(eq(gmailIntakeRetries.gmailMessageId, params.messageId));

  await logIntakeFailureActivity({
    messageId: params.messageId,
    entityId: deadLetterId || randomUUID(),
    source: params.source,
    error: lastError,
    stage: "dead_letter",
    attemptCount: params.attemptCount,
    snapshot,
  });

  await sendDeadLetterAlert({
    messageId: params.messageId,
    from: snapshot?.from || "(unknown)",
    subject: snapshot?.subject || "(No Subject)",
    lastError,
    attemptCount: params.attemptCount,
  });
}

export async function scheduleIntakeRetry(params: {
  messageId: string;
  source: IntakeSource;
  error: unknown;
  /** When true, skip retries and go straight to dead-letter (e.g. 404). */
  immediateDeadLetter?: boolean;
}): Promise<{ scheduled: boolean; deadLetter: boolean; attemptCount: number }> {
  const db = requireDb();
  const lastError = truncateError(params.error);

  const forceDeadLetter =
    params.immediateDeadLetter || isPermanentIntakeError(params.error);

  if (forceDeadLetter) {
    await moveToDeadLetter({
      messageId: params.messageId,
      source: params.source,
      error: params.error,
      attemptCount: 1,
    });
    return { scheduled: false, deadLetter: true, attemptCount: 1 };
  }

  const existing = await db
    .select()
    .from(gmailIntakeRetries)
    .where(eq(gmailIntakeRetries.gmailMessageId, params.messageId))
    .limit(1);

  const priorCount = existing[0]?.attemptCount ?? 0;
  const newCount = priorCount + 1;

  if (newCount > MAX_INTAKE_RETRIES) {
    await moveToDeadLetter({
      messageId: params.messageId,
      source: params.source,
      error: params.error,
      attemptCount: newCount,
    });
    return { scheduled: false, deadLetter: true, attemptCount: newCount };
  }

  const nextAt = nextRetryAt(newCount);
  const now = new Date();

  if (existing[0]) {
    await db
      .update(gmailIntakeRetries)
      .set({
        attemptCount: newCount,
        lastError,
        nextRetryAt: nextAt,
        updatedDate: now,
      })
      .where(eq(gmailIntakeRetries.id, existing[0].id));
  } else {
    await db.insert(gmailIntakeRetries).values({
      gmailMessageId: params.messageId,
      attemptCount: newCount,
      lastError,
      nextRetryAt: nextAt,
      source: params.source,
    });
  }

  console.warn(
    `[email-intake] Scheduled retry ${newCount}/${MAX_INTAKE_RETRIES} for ${params.messageId} at ${nextAt.toISOString()}: ${lastError.slice(0, 200)}`
  );

  // Best-effort snapshot for AI Logs (don't block on Gmail failures).
  const snapshot = await fetchMessageSnapshot(params.messageId);
  await logIntakeFailureActivity({
    messageId: params.messageId,
    entityId: existing[0]?.id || randomUUID(),
    source: params.source,
    error: lastError,
    stage: "retry_queued",
    attemptCount: newCount,
    snapshot,
  });

  return { scheduled: true, deadLetter: false, attemptCount: newCount };
}

export async function clearRetry(messageId: string): Promise<void> {
  const db = requireDb();
  await db
    .delete(gmailIntakeRetries)
    .where(eq(gmailIntakeRetries.gmailMessageId, messageId));
}

export async function listDueRetries(limit = 10): Promise<
  Array<{
    gmailMessageId: string;
    source: IntakeSource;
    attemptCount: number;
  }>
> {
  const db = requireDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(gmailIntakeRetries)
    .where(lte(gmailIntakeRetries.nextRetryAt, now))
    .limit(limit);

  return rows.map((row) => ({
    gmailMessageId: row.gmailMessageId,
    source: (row.source || "poller") as IntakeSource,
    attemptCount: row.attemptCount,
  }));
}

export function isTerminalProcessedStatus(
  status: string | null | undefined
): boolean {
  return TERMINAL_PROCESSED_STATUSES.has(String(status || ""));
}
