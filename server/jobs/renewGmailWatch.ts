import { env } from "../config/env.js";
import {
  getGmailConnection,
  getGmailStatus,
} from "../services/gmail/gmailClient.js";
import {
  getPollState,
} from "../services/gmail/handleContactFormEmail.js";
import { renewGmailWatch } from "../services/gmail/watch.js";

const RENEW_IF_WITHIN_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Renew Gmail users.watch when missing or expiring within 48 hours.
 * No-op when Gmail is disconnected or GMAIL_PUBSUB_TOPIC is unset.
 */
export async function renewGmailWatchJob(): Promise<{
  skipped: boolean;
  reason?: string;
  result?: Awaited<ReturnType<typeof renewGmailWatch>>;
}> {
  if (!env.gmailPubsubTopic()) {
    return { skipped: true, reason: "GMAIL_PUBSUB_TOPIC not set" };
  }

  const status = await getGmailStatus();
  if (!status.connected) {
    return { skipped: true, reason: "Gmail not connected" };
  }

  // Confirm a connection row exists (status alone is enough, but be safe).
  const connection = await getGmailConnection();
  if (!connection) {
    return { skipped: true, reason: "Gmail not connected" };
  }

  const poll = await getPollState();
  const expiresAt = poll?.watchExpiration
    ? new Date(poll.watchExpiration).getTime()
    : null;
  const needsRenew =
    !expiresAt || expiresAt - Date.now() < RENEW_IF_WITHIN_MS;

  if (!needsRenew) {
    return {
      skipped: true,
      reason: `watch still valid until ${poll?.watchExpiration?.toISOString?.() || expiresAt}`,
    };
  }

  const result = await renewGmailWatch();
  console.log(
    `[gmail-watch] Renewed watch — expires ${result.watchExpiration || result.expiration}`
  );
  return { skipped: false, result };
}
