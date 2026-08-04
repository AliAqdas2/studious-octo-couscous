import cron from "node-cron";
import { env } from "../config/env.js";
import { checkGmailConnection } from "./checkGmailConnection.js";
import { pollGmailInbox } from "./pollGmailInbox.js";
import { processScheduledCallRetries } from "./processScheduledCallRetries.js";
import { renewGmailWatchJob } from "./renewGmailWatch.js";
import { retryGmailIntake } from "./retryGmailIntake.js";
import { sendDailyDigest } from "./sendDailyDigest.js";

let started = false;

export function startJobs(): void {
  if (!env.enableJobs()) {
    console.log("[jobs] ENABLE_JOBS is not set — background jobs disabled");
    return;
  }
  if (started) return;
  started = true;

  // Every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    pollGmailInbox().catch((err) => {
      console.error(
        "[jobs] pollGmailInbox failed:",
        err instanceof Error ? err.message : err
      );
    });
  });

  // Every 5 minutes — drain due scheduled call retries
  cron.schedule("*/5 * * * *", () => {
    processScheduledCallRetries().catch((err) => {
      console.error(
        "[jobs] processScheduledCallRetries failed:",
        err instanceof Error ? err.message : err
      );
    });
    retryGmailIntake().catch((err) => {
      console.error(
        "[jobs] retryGmailIntake failed:",
        err instanceof Error ? err.message : err
      );
    });
  });

  // Daily 7:00 AM America/New_York — team task digest
  cron.schedule(
    "0 7 * * *",
    () => {
      sendDailyDigest().catch((err) => {
        console.error(
          "[jobs] sendDailyDigest failed:",
          err instanceof Error ? err.message : err
        );
      });
    },
    { timezone: "America/New_York" }
  );

  // Daily 3:30 AM ET — renew Gmail Pub/Sub watch before ~7 day expiry
  cron.schedule(
    "30 3 * * *",
    () => {
      renewGmailWatchJob().catch((err) => {
        console.error(
          "[jobs] renewGmailWatch failed:",
          err instanceof Error ? err.message : err
        );
      });
    },
    { timezone: "America/New_York" }
  );

  // Hourly — force-refresh OAuth token + alert if disconnected
  cron.schedule("15 * * * *", () => {
    checkGmailConnection().catch((err) => {
      console.error(
        "[jobs] checkGmailConnection failed:",
        err instanceof Error ? err.message : err
      );
    });
  });

  // One-shot ~30s after boot: re-arm watch + exercise token
  setTimeout(() => {
    renewGmailWatchJob().catch((err) => {
      console.error(
        "[jobs] boot renewGmailWatch failed:",
        err instanceof Error ? err.message : err
      );
    });
    checkGmailConnection().catch((err) => {
      console.error(
        "[jobs] boot checkGmailConnection failed:",
        err instanceof Error ? err.message : err
      );
    });
  }, 30_000);

  console.log(
    "[jobs] Started pollGmailInbox (15m) + processScheduledCallRetries/retryGmailIntake (5m) + sendDailyDigest (7 AM ET) + renewGmailWatch (3:30 AM ET) + checkGmailConnection (hourly)"
  );
}
