/**
 * One-shot daily digest send (same logic as the 7 AM ET cron job).
 *
 * Local:  npm run jobs:send-digest
 * Docker: docker exec -it mangia_app node dist/send-daily-digest.js
 */
import { config } from "dotenv";
import { sendDailyDigest } from "../server/jobs/sendDailyDigest.js";

config();

async function main(): Promise<void> {
  console.log("[send-daily-digest] Starting…");
  const result = await sendDailyDigest();
  console.log("[send-daily-digest] Result:", JSON.stringify(result, null, 2));

  if (result.success === true) {
    process.exit(0);
  }

  if (result.skipped) {
    console.warn(
      `[send-daily-digest] Skipped: ${String(result.skipped)} (exit 1)`
    );
    process.exit(1);
  }

  console.error("[send-daily-digest] Send did not succeed (exit 1)");
  process.exit(1);
}

main().catch((err) => {
  console.error(
    "[send-daily-digest] Failed:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
