import { Router, type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { inspect } from "node:util";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { processedGmailMessages } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { isTerminalProcessedStatus } from "../../services/gmail/intakeRetry.js";
import {
  getCurrentHistoryId,
  getPollState,
  handleContactFormEmail,
  listNewInboxMessageIds,
  listUnprocessedInboxMessageIds,
  upsertPollState,
} from "../../services/gmail/handleContactFormEmail.js";

const router = Router();
const LOG = "[gmail-webhook]";

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}

/** Full object dumps — only when GMAIL_INTAKE_DEBUG is on. */
function dump(label: string, value: unknown): void {
  if (!env.gmailIntakeDebug()) return;
  const text =
    typeof value === "string"
      ? value
      : inspect(value, {
          depth: 12,
          colors: false,
          maxArrayLength: 200,
          maxStringLength: 50_000,
          breakLength: 120,
        });
  console.log(`${LOG} ${label}\n${text}`);
}

function checkWebhookSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const secret = env.gmailWebhookSecret();
  if (!secret) {
    next();
    return;
  }
  const provided =
    req.header("X-Gmail-Webhook-Secret") ||
    req.header("x-gmail-webhook-secret") ||
    "";
  if (provided !== secret) {
    next(new AppError("Invalid Gmail webhook secret", 403));
    return;
  }
  next();
}

function extractMessageIdsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  const fromData = (b.data as { new_message_ids?: string[] } | undefined)
    ?.new_message_ids;
  if (Array.isArray(fromData)) {
    return fromData.filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(b.messageIds)) {
    return b.messageIds.filter((id): id is string => typeof id === "string");
  }
  if (Array.isArray(b.new_message_ids)) {
    return b.new_message_ids.filter(
      (id): id is string => typeof id === "string"
    );
  }
  return [];
}

/** Decode Google Pub/Sub push envelope → optional historyId hint + raw payload. */
function parsePubSubEnvelope(body: unknown): {
  historyId: string | null;
  decodedJson: unknown;
  decodedRaw: string | null;
  messageMeta: Record<string, unknown> | null;
} {
  if (!body || typeof body !== "object") {
    return {
      historyId: null,
      decodedJson: null,
      decodedRaw: null,
      messageMeta: null,
    };
  }
  const envelope = body as {
    message?: {
      data?: string;
      messageId?: string;
      publishTime?: string;
      attributes?: Record<string, string>;
    };
    subscription?: string;
  };
  const message = envelope.message;
  if (!message?.data) {
    return {
      historyId: null,
      decodedJson: null,
      decodedRaw: null,
      messageMeta: message
        ? {
            messageId: message.messageId,
            publishTime: message.publishTime,
            attributes: message.attributes,
            hasData: false,
          }
        : null,
    };
  }

  let decodedRaw: string | null = null;
  let decodedJson: unknown = null;
  let historyId: string | null = null;
  try {
    decodedRaw = Buffer.from(message.data, "base64").toString("utf8");
    try {
      decodedJson = JSON.parse(decodedRaw) as { historyId?: string | number };
      const hid = (decodedJson as { historyId?: string | number }).historyId;
      historyId = hid != null ? String(hid) : null;
    } catch {
      decodedJson = { _parseError: true, raw: decodedRaw };
    }
  } catch (err) {
    decodedRaw = `[base64 decode failed: ${err instanceof Error ? err.message : String(err)}]`;
  }

  return {
    historyId,
    decodedJson,
    decodedRaw,
    messageMeta: {
      messageId: message.messageId,
      publishTime: message.publishTime,
      attributes: message.attributes,
      dataBase64Length: message.data.length,
      subscription: envelope.subscription,
    },
  };
}

async function resolveMessageIds(body: unknown): Promise<{
  messageIds: string[];
  source: "webhook" | "poller";
  detail: Record<string, unknown>;
}> {
  const direct = extractMessageIdsFromBody(body);
  const sourceHint =
    body &&
    typeof body === "object" &&
    (body as { source?: string }).source === "poller"
      ? "poller"
      : "webhook";

  if (direct.length > 0) {
    log(`direct IDs from body count=${direct.length}`);
    dump("direct messageIds", direct);
    return {
      messageIds: direct,
      source: sourceHint,
      detail: { path: "direct_body_ids", count: direct.length },
    };
  }

  const isPubSub =
    body &&
    typeof body === "object" &&
    Boolean((body as { message?: unknown }).message);

  if (!isPubSub) {
    log("no Pub/Sub envelope and no direct message IDs");
    return {
      messageIds: [],
      source: "webhook",
      detail: { path: "empty_non_pubsub" },
    };
  }

  const pubsub = parsePubSubEnvelope(body);
  dump("Pub/Sub message meta", pubsub.messageMeta);
  dump("Pub/Sub decoded raw", pubsub.decodedRaw);
  dump("Pub/Sub decoded JSON", pubsub.decodedJson);

  const state = await getPollState();
  dump("poll state before history.list", state);
  let startHistoryId = state?.lastHistoryId;

  if (!startHistoryId) {
    const current = await getCurrentHistoryId();
    log(`seed history cursor historyId=${current} (no messages this hit)`);
    await upsertPollState({
      lastHistoryId: current,
      lastWebhookReceivedAt: new Date(),
    });
    return {
      messageIds: [],
      source: "webhook",
      detail: {
        path: "seed_history_cursor",
        seededHistoryId: current,
        pubsubHistoryHint: pubsub.historyId,
      },
    };
  }

  let { messageIds, newHistoryId } = await listNewInboxMessageIds(
    startHistoryId,
    20
  );
  dump("history.list messageIds", messageIds);

  let catchUpCount = 0;
  if (messageIds.length === 0 && newHistoryId !== startHistoryId) {
    try {
      messageIds = await listUnprocessedInboxMessageIds(20);
      catchUpCount = messageIds.length;
      dump("catch-up messageIds", messageIds);
    } catch (catchUpErr) {
      console.error(
        `${LOG} catch-up failed:`,
        catchUpErr instanceof Error ? catchUpErr.message : catchUpErr
      );
    }
  }

  await upsertPollState({
    lastHistoryId: newHistoryId,
    lastWebhookReceivedAt: new Date(),
  });

  const path =
    catchUpCount > 0
      ? "pubsub_history_list_with_catchup"
      : "pubsub_history_list";
  log(
    `history.list path=${path} start=${startHistoryId} → ${newHistoryId}` +
      ` messages=${messageIds.length}` +
      (catchUpCount > 0 ? ` catchUp=${catchUpCount}` : "") +
      (pubsub.historyId ? ` pubsubHint=${pubsub.historyId}` : "")
  );

  return {
    messageIds,
    source: "webhook",
    detail: {
      path,
      startHistoryId,
      newHistoryId,
      pubsubHistoryHint: pubsub.historyId,
      messageCount: messageIds.length,
      catchUpCount,
    },
  };
}

router.post("/", checkWebhookSecret, async (req, res, next) => {
  const started = Date.now();
  dump("request headers", {
    "content-type": req.headers["content-type"],
    "user-agent": req.headers["user-agent"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-cloud-trace-context": req.headers["x-cloud-trace-context"],
    "ce-type": req.headers["ce-type"],
    "ce-source": req.headers["ce-source"],
    host: req.headers.host,
    "x-gmail-webhook-secret": req.headers["x-gmail-webhook-secret"]
      ? "[present]"
      : "[absent]",
  });
  dump("raw request body (full)", req.body);

  try {
    const resolved = await resolveMessageIds(req.body);
    const { messageIds, source, detail } = resolved;
    dump("resolveMessageIds detail", detail);

    let toProcess = messageIds;
    const dedupeSkipped: { id: string; status: string }[] = [];
    if (messageIds.length > 0) {
      const db = getDb();
      if (db) {
        const filtered: string[] = [];
        for (const id of messageIds) {
          const seen = await db
            .select()
            .from(processedGmailMessages)
            .where(eq(processedGmailMessages.gmailMessageId, id))
            .limit(1);
          if (!seen[0] || !isTerminalProcessedStatus(seen[0].status)) {
            filtered.push(id);
          } else {
            dedupeSkipped.push({
              id,
              status: String(seen[0].status ?? "unknown"),
            });
          }
        }
        toProcess = filtered;
      } else {
        log("WARNING: DB not configured — skipping processed-message dedupe");
      }
    }

    dump("dedupe: already processed (skipped)", dedupeSkipped);
    dump("dedupe: toProcess", toProcess);

    if (messageIds.length > 0 || toProcess.length > 0) {
      log(
        `process source=${source} raw=${messageIds.length} dedupeSkip=${dedupeSkipped.length} toProcess=${toProcess.length}`
      );
    }

    const result = await handleContactFormEmail({
      messageIds: toProcess,
      source,
      markWebhook: source === "webhook",
    });

    const elapsedMs = Date.now() - started;
    dump("handleContactFormEmail FULL result", result);
    log(
      `done ok=${result.ok} created=${result.created} spam=${result.spam} skipped=${result.skipped} elapsedMs=${elapsedMs}`
    );

    res.json(result);
  } catch (err) {
    const elapsedMs = Date.now() - started;
    console.error(
      `${LOG} FAILED after ${elapsedMs}ms:`,
      err instanceof Error ? err.stack || err.message : err
    );
    dump("error object", err);
    next(err);
  }
});

export default router;
