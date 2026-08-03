import cron from "node-cron";
import { env } from "../config/env.js";
import { pollGmailInbox } from "./pollGmailInbox.js";
import { processScheduledCallRetries } from "./processScheduledCallRetries.js";
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

  console.log(
    "[jobs] Started pollGmailInbox (15m) + processScheduledCallRetries (5m) + sendDailyDigest (7 AM ET)"
  );
}
