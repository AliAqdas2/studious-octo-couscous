import { eq, lte } from "drizzle-orm";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import {
  gmailIntakeDeadLetters,
  gmailIntakeRetries,
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
const ALERT_DEDUP_MS = 60 * 60 * 1000;

export type IntakeSource = "webhook" | "poller";

export const TERMINAL_PROCESSED_STATUSES = new Set([
  "lead",
  "spam",
  "ignored",
  "failed",
]);

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
  const existing = await db
    .select()
    .from(gmailIntakeDeadLetters)
    .where(eq(gmailIntakeDeadLetters.gmailMessageId, params.messageId))
    .limit(1);

  const prior = existing[0];
  if (
    prior?.alertSentAt &&
    Date.now() - new Date(prior.alertSentAt).getTime() < ALERT_DEDUP_MS
  ) {
    return;
  }

  const appUrl = env.appUrl().replace(/\/$/, "");
  const subject = `Mangia CRM: Gmail intake failed — ${params.subject || params.messageId}`;
  const body = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;">
  <h2 style="color:#C84B31;">Gmail intake dead-letter</h2>
  <p>An inbound email could not be processed after ${params.attemptCount} attempt(s).</p>
  <ul>
    <li><strong>Message ID:</strong> ${params.messageId}</li>
    <li><strong>From:</strong> ${params.from.replace(/</g, "&lt;")}</li>
    <li><strong>Subject:</strong> ${params.subject.replace(/</g, "&lt;")}</li>
    <li><strong>Error:</strong> ${params.lastError.replace(/</g, "&lt;")}</li>
  </ul>
  <p>The full email body is preserved in <code>gmail_intake_dead_letters</code>.</p>
  <p>Review at <a href="${appUrl}">${appUrl}</a></p>
</body></html>`;

  for (const to of env.digestRecipients()) {
    try {
      await sendGmailEmail({
        to,
        subject,
        body,
        html: true,
        userName: "System (Gmail Intake)",
      });
    } catch (sendErr) {
      console.error(
        `${LOG} Failed to send alert to ${to}:`,
        sendErr instanceof Error ? sendErr.message : sendErr
      );
    }
  }

  await db
    .update(gmailIntakeDeadLetters)
    .set({ alertSentAt: new Date(), updatedDate: new Date() })
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

  try {
    await db.insert(gmailIntakeDeadLetters).values({
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate") && !msg.includes("unique")) {
      console.error(`${LOG} insert dead-letter failed:`, msg);
    }
  }

  await recordFailedProcessed(params.messageId, params.source);

  await db
    .delete(gmailIntakeRetries)
    .where(eq(gmailIntakeRetries.gmailMessageId, params.messageId));

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

  if (params.immediateDeadLetter) {
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
