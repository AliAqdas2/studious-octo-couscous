import {
  getCurrentHistoryId,
  getPollState,
  handleContactFormEmail,
  listNewInboxMessageIds,
  listUnprocessedInboxMessageIds,
  upsertPollState,
} from "../services/gmail/handleContactFormEmail.js";
import { getDb } from "../db/index.js";
import { processedGmailMessages } from "../db/schema/index.js";
import { isTerminalProcessedStatus } from "../services/gmail/intakeRetry.js";
import { eq } from "drizzle-orm";

const WEBHOOK_HEALTH_THRESHOLD_MIN = 90;
const MAX_MESSAGES_PER_RUN = 20;

export async function pollGmailInbox(): Promise<Record<string, unknown>> {
  const startedAt = new Date();
  let state = await getPollState();

  const lastWebhookAt = state?.lastWebhookReceivedAt
    ? new Date(state.lastWebhookReceivedAt)
    : null;
  const minutesSinceWebhook = lastWebhookAt
    ? (startedAt.getTime() - lastWebhookAt.getTime()) / 60000
    : Infinity;

  if (lastWebhookAt && minutesSinceWebhook < WEBHOOK_HEALTH_THRESHOLD_MIN) {
    await upsertPollState({ lastPolledAt: startedAt });
    console.log(
      `[poll-gmail] Webhook healthy (last hit ${minutesSinceWebhook.toFixed(1)} min ago) — skipping.`
    );
    return {
      ok: true,
      skipped: "webhook_healthy",
      minutes_since_webhook: Number(minutesSinceWebhook.toFixed(1)),
    };
  }

  console.log(
    `[poll-gmail] Webhook stale (${lastWebhookAt ? minutesSinceWebhook.toFixed(1) + " min" : "never"}) — running history check.`
  );

  if (!state?.lastHistoryId) {
    const historyId = await getCurrentHistoryId();
    await upsertPollState({
      lastHistoryId: historyId,
      lastPolledAt: startedAt,
    });
    console.log(`[poll-gmail] First-run seed: historyId=${historyId}`);
    return { ok: true, initialized: true, history_id: historyId };
  }

  let messageIds: string[] = [];
  let newHistoryId = state.lastHistoryId;
  let catchUpCount = 0;

  try {
    const result = await listNewInboxMessageIds(
      state.lastHistoryId,
      MAX_MESSAGES_PER_RUN
    );
    messageIds = result.messageIds;
    newHistoryId = result.newHistoryId;
  } catch (err) {
    console.error("[poll-gmail] history.list failed:", err);
    throw err;
  }

  if (messageIds.length === 0 && newHistoryId !== state.lastHistoryId) {
    console.log(
      `[poll-gmail] history advanced ${state.lastHistoryId} → ${newHistoryId} with 0 IDs — running INBOX catch-up`
    );
    try {
      messageIds = await listUnprocessedInboxMessageIds(MAX_MESSAGES_PER_RUN);
      catchUpCount = messageIds.length;
      console.log(`[poll-gmail] catch-up recovered ${catchUpCount} message(s)`);
    } catch (catchUpErr) {
      console.error(
        "[poll-gmail] catch-up failed:",
        catchUpErr instanceof Error ? catchUpErr.message : catchUpErr
      );
    }
  }

  if (messageIds.length === 0) {
    await upsertPollState({
      lastHistoryId: newHistoryId,
      lastPolledAt: startedAt,
    });
    console.log(
      `[poll-gmail] No new messages. Cursor advanced ${state.lastHistoryId} → ${newHistoryId}`
    );
    return {
      ok: true,
      found: 0,
      catch_up: catchUpCount,
      new_history_id: newHistoryId,
    };
  }

  console.log(
    `[poll-gmail] Found ${messageIds.length} new message(s) — handing off to handleContactFormEmail.`
  );

  const db = getDb();
  const toProcess: string[] = [];
  for (const id of messageIds) {
    if (!db) {
      toProcess.push(id);
      continue;
    }
    const seen = await db
      .select()
      .from(processedGmailMessages)
      .where(eq(processedGmailMessages.gmailMessageId, id))
      .limit(1);
    if (seen[0] && isTerminalProcessedStatus(seen[0].status)) {
      console.log(`[poll-gmail] Already processed as ${seen[0].status}: ${id}`);
      continue;
    }
    toProcess.push(id);
  }

  let handlerResult = null;
  if (toProcess.length > 0) {
    handlerResult = await handleContactFormEmail({
      messageIds: toProcess,
      source: "poller",
      markWebhook: false,
    });
  }

  await upsertPollState({
    lastHistoryId: newHistoryId,
    lastPolledAt: startedAt,
  });

  return {
    ok: true,
    webhook_stale_minutes: lastWebhookAt
      ? Number(minutesSinceWebhook.toFixed(1))
      : null,
    found: messageIds.length,
    catch_up: catchUpCount,
    processed_now: toProcess.length,
    skipped_as_dup: messageIds.length - toProcess.length,
    new_history_id: newHistoryId,
    handler_result: handlerResult,
  };
}
