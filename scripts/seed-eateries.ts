/**
 * Seed the food-tour restaurant catalog and their order schemes.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed-eateries
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedEateries } from "../server/services/events/seedEateries.js";

config();

const LOG = "[seed-eateries]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedEateries();
  console.log(`${LOG} upserted=${result.upserted}`);
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
