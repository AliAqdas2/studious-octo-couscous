import { Router, type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
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

/** Decode Google Pub/Sub push envelope → optional historyId hint. */
function parsePubSubHistoryHint(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: { data?: string } }).message;
  if (!message?.data) return null;
  try {
    const decoded = Buffer.from(message.data, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { historyId?: string | number };
    return parsed.historyId != null ? String(parsed.historyId) : null;
  } catch {
    return null;
  }
}

async function resolveMessageIds(body: unknown): Promise<{
  messageIds: string[];
  source: "webhook" | "poller";
}> {
  const direct = extractMessageIdsFromBody(body);
  const sourceHint =
    body &&
    typeof body === "object" &&
    (body as { source?: string }).source === "poller"
      ? "poller"
      : "webhook";

  if (direct.length > 0) {
    return { messageIds: direct, source: sourceHint };
  }

  // Pub/Sub push: use stored cursor + history.list
  const isPubSub =
    body &&
    typeof body === "object" &&
    Boolean((body as { message?: unknown }).message);

  if (!isPubSub) {
    return { messageIds: [], source: "webhook" };
  }

  parsePubSubHistoryHint(body); // acknowledged for logging / future use
  const state = await getPollState();
  let startHistoryId = state?.lastHistoryId;

  if (!startHistoryId) {
    const current = await getCurrentHistoryId();
    await upsertPollState({
      lastHistoryId: current,
      lastWebhookReceivedAt: new Date(),
    });
    return { messageIds: [], source: "webhook" };
  }

  const { messageIds, newHistoryId } =
    await listNewInboxMessageIds(startHistoryId, 20);
  await upsertPollState({
    lastHistoryId: newHistoryId,
    lastWebhookReceivedAt: new Date(),
  });

  return { messageIds, source: "webhook" };
}

router.post("/", checkWebhookSecret, async (req, res, next) => {
  try {
    const { messageIds, source } = await resolveMessageIds(req.body);

    // Dedup before handler for poller handoff efficiency
    let toProcess = messageIds;
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
          if (!seen[0]) filtered.push(id);
        }
        toProcess = filtered;
      }
    }

    const result = await handleContactFormEmail({
      messageIds: toProcess,
      source,
      markWebhook: source === "webhook",
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
