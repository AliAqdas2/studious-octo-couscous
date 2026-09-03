/**
 * Seed instructor bios from data/instructors-and-bios.md.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed-instructors
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedInstructors } from "../server/services/events/seedInstructors.js";

config();

const LOG = "[seed-instructors]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  const result = await seedInstructors();
  console.log(`${LOG} upserted=${result.upserted}`);
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
