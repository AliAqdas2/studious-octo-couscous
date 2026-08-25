/**
 * Seed cooking inventory catalog + Vendor Directory vendors.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed-inventory
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedInventoryAndVendors } from "../server/services/events/seedInventoryAndVendors.js";

config();

const LOG = "[seed-inventory]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedInventoryAndVendors();
  console.log(
    `${LOG} vendors=${result.vendorsUpserted} catalog=${result.catalogUpserted}`
  );
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
