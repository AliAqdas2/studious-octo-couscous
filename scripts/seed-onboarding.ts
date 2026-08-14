/**
 * Seed onboarding workflow templates: ESA ready + Coming soon stubs for other roles.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed-onboarding
 */
import { config } from "dotenv";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { seedOnboardingWorkflows } from "../server/services/onboarding/seedWorkflows.js";

config();

const LOG = "[seed-onboarding]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }
  console.log(`${LOG} starting`);
  await seedOnboardingWorkflows();
  console.log(`${LOG} done`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
