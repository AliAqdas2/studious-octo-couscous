import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { getGmailApi } from "./gmailClient.js";
import {
  getCurrentHistoryId,
  upsertPollState,
} from "./handleContactFormEmail.js";

export interface RenewWatchResult {
  ok: true;
  historyId: string;
  expiration: string | null;
  topic: string;
  watchExpiration: string | null;
}

/**
 * Register (or renew) Gmail users.watch for Pub/Sub push.
 * Persists watch_expiration so the keep-alive job can renew before it dies.
 */
export async function renewGmailWatch(): Promise<RenewWatchResult> {
  const topic = env.gmailPubsubTopic();
  if (!topic) {
    throw new AppError(
      "GMAIL_PUBSUB_TOPIC is not set. Create a Pub/Sub topic and grant Gmail publish rights.",
      503
    );
  }

  const gmail = await getGmailApi();
  const watchRes = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: topic,
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    },
  });

  const historyId = watchRes.data.historyId
    ? String(watchRes.data.historyId)
    : await getCurrentHistoryId();

  const expirationRaw = watchRes.data.expiration || null;
  const watchExpiration = expirationRaw
    ? new Date(Number(expirationRaw))
    : null;
  const now = new Date();

  await upsertPollState({
    lastHistoryId: historyId,
    lastWebhookReceivedAt: now,
    watchExpiration,
    watchRegisteredAt: now,
    lastConnectionError: null,
  });

  return {
    ok: true,
    historyId,
    expiration: expirationRaw,
    topic,
    watchExpiration: watchExpiration ? watchExpiration.toISOString() : null,
  };
}
