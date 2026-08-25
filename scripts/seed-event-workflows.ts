/**
 * Seed In-Person Cooking Family A workflow template + task defs.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed-event-workflows
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb, logDatabaseStartup } from "../server/db/index.js";
import { seedEventWorkflows } from "../server/services/events/seedEventWorkflows.js";

config();

const LOG = "[seed-event-workflows]";

async function main(): Promise<void> {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log(`${LOG} starting`);
  console.log(
    `${LOG} DATABASE_URL is set (${url.includes("supabase") ? "supabase" : "postgres"} host)`
  );

  await logDatabaseStartup().then((ok) => {
    if (!ok) {
      throw new Error(
        "Database connection failed — fix DATABASE_URL / network, then retry"
      );
    }
  });

  const db = getDb();
  if (!db) {
    throw new Error("getDb() returned null after connection check");
  }

  console.log(`${LOG} seeding templates…`);
  const result = await seedEventWorkflows();
  console.log(
    `${LOG} Cooking template id=${result.templateId} tasks=${result.taskDefCount} resources=${result.resourceCount}`
  );
  console.log(`${LOG} templates seeded=${result.templatesSeeded}`);
  for (const row of result.experienceResults) {
    console.log(
      `${LOG}  - ${row.experienceKey} quality=${row.docQuality} tasks=${row.taskDefCount}`
    );
  }
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
