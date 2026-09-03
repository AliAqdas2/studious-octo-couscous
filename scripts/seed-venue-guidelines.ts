/**
 * Seed venue guidelines HTML onto house venues.
 * Idempotent overwrite — safe to re-run.
 *
 * Usage: npm run db:seed-venue-guidelines
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedVenueGuidelines } from "../server/services/events/seedVenueGuidelines.js";

config();

const LOG = "[seed-venue-guidelines]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedVenueGuidelines();
  console.log(
    `${LOG} updated=${result.updated} skippedMissingVenue=${result.skippedMissingVenue}`
  );
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
