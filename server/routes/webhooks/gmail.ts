import { Router, type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { inspect } from "node:util";
import { env } from "../../config/env.js";
import { getDb } from "../../db/index.js";
import { processedGmailMessages } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import {
  getCurrentHistoryId,
  getPollState,
  handleContactFormEmail,
  listNewInboxMessageIds,
  upsertPollState,
} from "../../services/gmail/handleContactFormEmail.js";

const router = Router();
const LOG = "[gmail-webhook]";

/** Dump anything — large objects fully expanded for debugging. */
function dump(label: string, value: unknown): void {
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

function log(...args: unknown[]): void {
  console.log(LOG, ...args);
}

function checkWebhookSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const secret = env.gmailWebhookSecret();
  if (!secret) {
    log("Secret check: GMAIL_WEBHOOK_SECRET unset — allowing request");
    next();
    return;
  }
  const provided =
    req.header("X-Gmail-Webhook-Secret") ||
    req.header("x-gmail-webhook-secret") ||
    "";
  const ok = provided === secret;
  log(
    `Secret check: provided=${provided ? "[set len=" + provided.length + "]" : "[empty]"} match=${ok}`
  );
  if (!ok) {
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
    log(`resolveMessageIds: direct IDs from body (${direct.length})`, direct);
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
    log("resolveMessageIds: not Pub/Sub and no direct message IDs");
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
  log(`Pub/Sub historyId hint: ${pubsub.historyId ?? "(none)"}`);

  const state = await getPollState();
  dump("poll state before history.list", state);
  let startHistoryId = state?.lastHistoryId;

  if (!startHistoryId) {
    const current = await getCurrentHistoryId();
    log(
      `No stored lastHistoryId — seeding cursor to current historyId=${current} (no messages processed this hit)`
    );
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

  log(`Calling history.list startHistoryId=${startHistoryId} max=20`);
  const { messageIds, newHistoryId } = await listNewInboxMessageIds(
    startHistoryId,
    20
  );
  log(
    `history.list result: ${messageIds.length} message(s), newHistoryId=${newHistoryId}`
  );
  dump("history.list messageIds", messageIds);

  await upsertPollState({
    lastHistoryId: newHistoryId,
    lastWebhookReceivedAt: new Date(),
  });
  log("poll state updated after history.list");

  return {
    messageIds,
    source: "webhook",
    detail: {
      path: "pubsub_history_list",
      startHistoryId,
      newHistoryId,
      pubsubHistoryHint: pubsub.historyId,
      messageCount: messageIds.length,
    },
  };
}

router.post("/", checkWebhookSecret, async (req, res, next) => {
  const started = Date.now();
  log("========== INCOMING REQUEST ==========");
  log(`time=${new Date().toISOString()} method=${req.method} path=${req.originalUrl}`);
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
    log(`source=${source} rawMessageIds=${messageIds.length}`);

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
          if (!seen[0]) {
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
    log(
      `Processing ${toProcess.length}/${messageIds.length} message(s) via handleContactFormEmail`
    );

    const result = await handleContactFormEmail({
      messageIds: toProcess,
      source,
      markWebhook: source === "webhook",
    });

    const elapsedMs = Date.now() - started;
    dump("handleContactFormEmail FULL result", result);
    log(
      `DONE ok=${result.ok} created=${result.created} spam=${result.spam} skipped=${result.skipped} elapsedMs=${elapsedMs}`
    );
    log("========== REQUEST COMPLETE ==========");

    res.json(result);
  } catch (err) {
    const elapsedMs = Date.now() - started;
    console.error(
      `${LOG} FAILED after ${elapsedMs}ms:`,
      err instanceof Error ? err.stack || err.message : err
    );
    dump("error object", err);
    log("========== REQUEST FAILED ==========");
    next(err);
  }
});

export default router;
