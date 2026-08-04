import { handleContactFormEmail } from "../services/gmail/handleContactFormEmail.js";
import { listDueRetries } from "../services/gmail/intakeRetry.js";

const MAX_PER_RUN = 10;

/**
 * Re-process Gmail messages that failed intake (AI/DB errors).
 * Fetches by message ID directly — does not rely on history.list.
 */
export async function retryGmailIntake(): Promise<Record<string, unknown>> {
  const due = await listDueRetries(MAX_PER_RUN);

  if (due.length === 0) {
    return { ok: true, retried: 0 };
  }

  console.log(
    `[retry-gmail-intake] Processing ${due.length} due retry message(s)`
  );

  let succeeded = 0;
  let stillRetrying = 0;
  let deadLetter = 0;

  for (const row of due) {
    try {
      const result = await handleContactFormEmail({
        messageIds: [row.gmailMessageId],
        source: row.source,
        markWebhook: false,
        isRetry: true,
      });

      const msgResult = result.results[0];
      if (msgResult?.outcome === "dead-letter") {
        deadLetter++;
      } else if (
        msgResult?.outcome === "retry-scheduled" ||
        msgResult?.outcome === "skipped"
      ) {
        stillRetrying++;
      } else if (
        msgResult?.outcome === "created" ||
        msgResult?.outcome?.includes("created") ||
        msgResult?.outcome === "spam" ||
        msgResult?.outcome === "already-processed"
      ) {
        succeeded++;
      } else {
        succeeded++;
      }
    } catch (err) {
      console.error(
        `[retry-gmail-intake] Handler failed for ${row.gmailMessageId}:`,
        err instanceof Error ? err.message : err
      );
      stillRetrying++;
    }
  }

  return {
    ok: true,
    retried: due.length,
    succeeded,
    still_retrying: stillRetrying,
    dead_letter: deadLetter,
  };
}
