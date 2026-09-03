/**
 * Link bundled venue photos to house venues (by name).
 * Idempotent — safe to re-run. Does not delete or modify venue rows.
 *
 * Usage: npm run db:seed-venue-images
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedVenueImages } from "../server/services/events/seedVenueImages.js";

config();

const LOG = "[seed-venue-images]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedVenueImages();
  console.log(
    `${LOG} upserted=${result.upserted} skippedMissingVenue=${result.skippedMissingVenue}`
  );
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
