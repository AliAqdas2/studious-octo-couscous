import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { sql } from "drizzle-orm";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb } from "../server/db/index.js";

config();

const CONFIRM_PHRASE = "ERASE PRODUCTION DATA";

/** Business / ops tables to wipe. Never includes users, refresh_tokens, gmail_connections. */
const TABLES_TO_TRUNCATE = [
  "mention_reads",
  "thread_messages",
  "tasks",
  "call_logs",
  "activity_logs",
  "role_assignments",
  "events",
  "leads",
  "clients",
  "event_templates",
  "email_templates",
  "stage_email_mappings",
  "processed_gmail_messages",
  "spam_emails",
  "fareharbor_events",
  "twilio_webhook_logs",
  "gmail_intake_retries",
  "gmail_intake_dead_letters",
  "gmail_poll_state",
  "password_reset_codes",
  "automation_config",
] as const;

async function confirmErase(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      "[erase-data] Refusing to erase without an interactive TTY. Run from a terminal."
    );
    return false;
  }

  console.log("");
  console.log("WARNING: This will permanently delete CRM business data.");
  console.log("Kept: users, refresh_tokens, gmail_connections, migrations.");
  console.log(`Type exactly: ${CONFIRM_PHRASE}`);
  console.log("");

  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question("> ")).trim();
    return answer === CONFIRM_PHRASE;
  } finally {
    rl.close();
  }
}

async function eraseData(): Promise<void> {
  console.log("[erase-data] Starting");

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("[erase-data] DATABASE_URL is not set");
  }

  const ok = await confirmErase();
  if (!ok) {
    console.error("[erase-data] Confirmation failed — aborted. No data changed.");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  if (!db) {
    throw new Error("[erase-data] getDb() returned null");
  }

  await db.execute(sql`select 1`);
  console.log("[erase-data] Database connection OK");

  const list = TABLES_TO_TRUNCATE.map((t) => `"${t}"`).join(", ");
  console.log(`[erase-data] Truncating ${TABLES_TO_TRUNCATE.length} tables...`);
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  );
  console.log("[erase-data] Truncate complete");

  await db.execute(sql`
    INSERT INTO automation_config (id, key, created_date, updated_date)
    VALUES (gen_random_uuid(), 'default', NOW(), NOW())
    ON CONFLICT (key) DO NOTHING
  `);
  console.log("[erase-data] Restored automation_config key=default");

  console.log(
    "[erase-data] Done. Run `npm run db:seed` if you need to ensure the admin user exists."
  );
  console.log("[erase-data] Next: `npm run db:load-data` to import scripts/data CSVs.");
}

eraseData()
  .then(() => {
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(
      "[erase-data] Failed:",
      err instanceof Error ? err.message : err
    );
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
