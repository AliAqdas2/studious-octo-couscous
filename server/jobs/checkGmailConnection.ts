import { env } from "../config/env.js";
import {
  forceRefreshGmailToken,
  getGmailStatus,
} from "../services/gmail/gmailClient.js";
import {
  getPollState,
  upsertPollState,
} from "../services/gmail/handleContactFormEmail.js";
import { sendGmailEmail } from "../services/gmail/send.js";

const ALERT_DEDUP_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Hourly OAuth keep-alive: force-refresh the access token so the refresh
 * token does not go stale. On failure, persist the error and email admins
 * (deduped to once per 12 hours). Alert send may itself fail if Gmail is
 * broken — always log loudly either way.
 */
export async function checkGmailConnection(): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}> {
  const status = await getGmailStatus();
  if (!status.connected) {
    return { ok: false, skipped: true, reason: "Gmail not connected" };
  }

  try {
    const result = await forceRefreshGmailToken();
    await upsertPollState({
      lastTokenRefreshAt: new Date(),
      lastConnectionError: null,
      disconnectAlertSentAt: null,
    });
    console.log(
      `[gmail-health] Token refresh OK for ${result.email} (expires ${result.expiresAt})`
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[gmail-health] CRITICAL: Gmail token refresh failed: ${message}`);

    const poll = await getPollState();
    const lastAlert = poll?.disconnectAlertSentAt
      ? new Date(poll.disconnectAlertSentAt).getTime()
      : 0;
    const shouldAlert = Date.now() - lastAlert > ALERT_DEDUP_MS;

    await upsertPollState({
      lastConnectionError: message.slice(0, 2000),
      ...(shouldAlert ? { disconnectAlertSentAt: new Date() } : {}),
    });

    if (shouldAlert) {
      const appUrl = env.appUrl().replace(/\/$/, "");
      const recipients = env.digestRecipients();
      const subject = "Mangia CRM: Gmail disconnected — reconnect required";
      const body = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;">
  <h2 style="color:#C84B31;">Gmail connection lost</h2>
  <p>The CRM could not refresh the Gmail OAuth token.</p>
  <p><strong>Error:</strong> ${message.replace(/</g, "&lt;")}</p>
  <p>Please reconnect Gmail at <a href="${appUrl}">${appUrl}</a> (Settings / Connect Gmail), then re-register the Pub/Sub watch if needed.</p>
  <p style="color:#888;font-size:13px;">This alert is sent at most once every 12 hours while the connection stays broken.</p>
</body></html>`;

      for (const to of recipients) {
        try {
          await sendGmailEmail({
            to,
            subject,
            body,
            html: true,
            userName: "System (Gmail Health)",
            systemAlert: true,
          });
        } catch (sendErr) {
          console.error(
            `[gmail-health] Failed to send disconnect alert to ${to}:`,
            sendErr instanceof Error ? sendErr.message : sendErr
          );
        }
      }
    }

    return { ok: false, reason: message };
  }
}
