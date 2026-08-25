/**
 * Seed house venues from legacy HOUSE_VENUES list.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed-venues
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedVenues } from "../server/services/events/seedVenues.js";

config();

const LOG = "[seed-venues]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedVenues();
  console.log(`${LOG} upserted=${result.upserted}`);
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
