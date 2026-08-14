import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  candidateSteps,
  candidates,
  onboardingWorkflowTemplates,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { toApiRecord } from "../entities/serialize.js";
import { resolveOnboardingVideoUrls } from "./videoResources.js";
import { mergeStepResources } from "./paperworkResources.js";
import { ensureCandidateWorkflowSteps } from "./createCandidate.js";
import { JOB_ROLES, type JobRole } from "./constants.js";

function mapStepForPortal(
  step: Record<string, unknown>,
  hireType: string | null
): Record<string, unknown> {
  const withPaperwork = mergeStepResources(step, hireType);
  const resources = withPaperwork.resources as Parameters<
    typeof resolveOnboardingVideoUrls
  >[0];
  return {
    ...withPaperwork,
    resources: resolveOnboardingVideoUrls(resources),
  };
}

export async function getMyOnboarding(
  userId: string
): Promise<Record<string, unknown>> {
  const db = getDb();
  if (!db) throw new AppError("Database not configured", 503);

  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.userId, userId))
    .limit(1);

  if (!row) {
    throw new AppError(
      "No onboarding record is linked to your account. Contact your manager.",
      404
    );
  }

  if (row.stage !== "Onboarding") {
    throw new AppError(
      `Your onboarding status is "${row.stage}". This portal is available during onboarding.`,
      403
    );
  }

  const jobRole = row.jobRole as JobRole;
  if (!(JOB_ROLES as readonly string[]).includes(jobRole)) {
    throw new AppError("Invalid job role on candidate record", 500);
  }

  const ensure = await ensureCandidateWorkflowSteps(row.id, jobRole);

  const steps = await db
    .select()
    .from(candidateSteps)
    .where(eq(candidateSteps.candidateId, row.id))
    .orderBy(asc(candidateSteps.sortOrder));

  const [template] = await db
    .select()
    .from(onboardingWorkflowTemplates)
    .where(eq(onboardingWorkflowTemplates.jobRole, row.jobRole))
    .limit(1);

  return {
    candidate: toApiRecord(row as unknown as Record<string, unknown>),
    workflow_status: template?.status ?? "coming_soon",
    steps_backfilled: ensure.backfilled,
    steps: steps.map((s) =>
      mapStepForPortal(
        toApiRecord(s as unknown as Record<string, unknown>),
        row.hireType
      )
    ),
  };
}
