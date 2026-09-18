/**
 * Seed default BEO host MC script template (idempotent — does not overwrite edits).
 *
 * Usage: npm run db:seed-beo-scripts
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedBeoScriptTemplates } from "../server/services/events/beoScriptTemplates.js";

config();

const LOG = "[seed-beo-scripts]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedBeoScriptTemplates();
  console.log(`${LOG} upserted=${result.upserted}`);
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
