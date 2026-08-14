/**
 * Backfill candidate_steps for candidates that have none yet.
 * Idempotent — safe to re-run.
 *
 * Usage: npm run db:backfill-candidate-steps
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { resolveDatabaseUrl } from "../server/db/config.js";
import { getDb } from "../server/db/index.js";
import { candidateSteps, candidates } from "../server/db/schema/index.js";
import { ensureCandidateWorkflowSteps } from "../server/services/onboarding/createCandidate.js";
import type { JobRole } from "../server/services/onboarding/constants.js";

config();

const LOG = "[backfill-candidate-steps]";

async function main(): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is not set");
  }

  const db = getDb();
  if (!db) throw new Error("getDb() returned null");

  const allCandidates = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      jobRole: candidates.jobRole,
    })
    .from(candidates);

  let backfilled = 0;
  let skipped = 0;
  let alreadyHadSteps = 0;

  for (const row of allCandidates) {
    const existing = await db
      .select({ id: candidateSteps.id })
      .from(candidateSteps)
      .where(eq(candidateSteps.candidateId, row.id))
      .limit(1);

    if (existing.length > 0) {
      alreadyHadSteps += 1;
      continue;
    }

    const result = await ensureCandidateWorkflowSteps(
      row.id,
      row.jobRole as JobRole
    );

    if (result.backfilled) {
      backfilled += 1;
      console.log(
        `${LOG} backfilled ${row.name} (${row.jobRole}): ${result.stepsCreated} steps`
      );
    } else {
      skipped += 1;
      console.log(
        `${LOG} skipped ${row.name} (${row.jobRole}): template ${result.templateStatus}`
      );
    }
  }

  console.log(
    `${LOG} done — backfilled=${backfilled} skipped=${skipped} already_had_steps=${alreadyHadSteps}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`${LOG} failed:`, err);
    process.exit(1);
  });
