import { and, asc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  candidateSteps,
  candidates,
  onboardingWorkflowSteps,
  onboardingWorkflowTemplates,
} from "../../db/schema/index.js";
import { toApiRecord } from "../entities/serialize.js";
import type { OnboardingStepResource } from "../../db/schema/onboarding-workflow-steps.js";
import {
  DEFAULT_CANDIDATE_STAGE,
  HIRE_SOURCES,
  HIRE_TYPES,
  JOB_ROLES,
  type JobRole,
} from "./constants.js";
import { resolveOnboardingVideoUrls } from "./videoResources.js";
import { mergeStepResources } from "./paperworkResources.js";

export interface CreateCandidateInput {
  name: string;
  email: string;
  phone?: string | null;
  jobRole: string;
  hireType: string;
  source: string;
  sourceDetail?: string | null;
  resumeUrl?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
}

function assertEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new AppError(
    `Invalid ${label}: ${value}. Expected one of: ${allowed.join(", ")}`,
    400
  );
}

/** Copy ready template steps onto a candidate. No-op for coming_soon. */
export async function instantiateCandidateWorkflow(
  candidateId: string,
  jobRole: JobRole
): Promise<{ templateStatus: "ready" | "coming_soon"; stepsCreated: number }> {
  const db = getDb();
  if (!db) throw new AppError("Database not configured", 500);

  const [template] = await db
    .select()
    .from(onboardingWorkflowTemplates)
    .where(
      and(
        eq(onboardingWorkflowTemplates.jobRole, jobRole),
        eq(onboardingWorkflowTemplates.isActive, true)
      )
    )
    .limit(1);

  if (!template || template.status !== "ready") {
    return { templateStatus: "coming_soon", stepsCreated: 0 };
  }

  const existing = await db
    .select({ id: candidateSteps.id })
    .from(candidateSteps)
    .where(eq(candidateSteps.candidateId, candidateId))
    .limit(1);
  if (existing.length > 0) {
    return { templateStatus: "ready", stepsCreated: 0 };
  }

  const steps = await db
    .select()
    .from(onboardingWorkflowSteps)
    .where(eq(onboardingWorkflowSteps.templateId, template.id))
    .orderBy(asc(onboardingWorkflowSteps.sortOrder));

  for (const step of steps) {
    await db.insert(candidateSteps).values({
      candidateId,
      workflowStepId: step.id,
      phase: step.phase,
      sortOrder: step.sortOrder,
      title: step.title,
      instructions: step.instructions,
      stepType: step.stepType,
      ownerRole: step.ownerRole,
      isGate: step.isGate,
      slaHours: step.slaHours,
      resources: (step.resources ?? []) as OnboardingStepResource[],
      status: "pending",
    });
  }

  return { templateStatus: "ready", stepsCreated: steps.length };
}

/** Idempotent: copy template steps if this candidate has none yet. */
export async function ensureCandidateWorkflowSteps(
  candidateId: string,
  jobRole: JobRole
): Promise<{
  backfilled: boolean;
  templateStatus: "ready" | "coming_soon";
  stepsCreated: number;
}> {
  const db = getDb();
  if (!db) throw new AppError("Database not configured", 500);

  const existing = await db
    .select({ id: candidateSteps.id })
    .from(candidateSteps)
    .where(eq(candidateSteps.candidateId, candidateId))
    .limit(1);

  if (existing.length > 0) {
    return { backfilled: false, templateStatus: "ready", stepsCreated: 0 };
  }

  const result = await instantiateCandidateWorkflow(candidateId, jobRole);
  return {
    backfilled: result.stepsCreated > 0,
    templateStatus: result.templateStatus,
    stepsCreated: result.stepsCreated,
  };
}

export async function createCandidateWithWorkflow(
  input: CreateCandidateInput
): Promise<Record<string, unknown>> {
  const db = getDb();
  if (!db) throw new AppError("Database not configured", 500);

  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) throw new AppError("name is required", 400);
  if (!email) throw new AppError("email is required", 400);

  const jobRole = assertEnum(input.jobRole, JOB_ROLES, "job_role");
  const hireType = assertEnum(input.hireType, HIRE_TYPES, "hire_type");
  const source = assertEnum(input.source, HIRE_SOURCES, "source");

  if (source === "Other" && !input.sourceDetail?.trim()) {
    throw new AppError("source_detail is required when source is Other", 400);
  }

  const [row] = await db
    .insert(candidates)
    .values({
      name,
      email,
      phone: input.phone?.trim() || null,
      jobRole,
      hireType,
      source,
      sourceDetail: input.sourceDetail?.trim() || null,
      stage: DEFAULT_CANDIDATE_STAGE,
      resumeUrl: input.resumeUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      assignedTo: input.assignedTo || null,
      createdBy: input.createdBy || null,
      retainForFuture: true,
    })
    .returning();

  if (!row) throw new AppError("Failed to create candidate", 500);

  const workflow = await instantiateCandidateWorkflow(row.id, jobRole);

  const steps = await db
    .select()
    .from(candidateSteps)
    .where(eq(candidateSteps.candidateId, row.id))
    .orderBy(asc(candidateSteps.sortOrder));

  return {
    ...toApiRecord(row as unknown as Record<string, unknown>),
    workflow_status: workflow.templateStatus,
    steps_created: workflow.stepsCreated,
    steps: steps.map((s) => toApiRecord(s as unknown as Record<string, unknown>)),
  };
}

export async function getCandidateDetail(
  candidateId: string
): Promise<Record<string, unknown>> {
  const db = getDb();
  if (!db) throw new AppError("Database not configured", 500);

  const [row] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);
  if (!row) throw new AppError("Candidate not found", 404);

  const ensure = await ensureCandidateWorkflowSteps(
    candidateId,
    row.jobRole as JobRole
  );

  const steps = await db
    .select()
    .from(candidateSteps)
    .where(eq(candidateSteps.candidateId, candidateId))
    .orderBy(asc(candidateSteps.sortOrder));

  const [template] = await db
    .select()
    .from(onboardingWorkflowTemplates)
    .where(
      and(
        eq(onboardingWorkflowTemplates.jobRole, row.jobRole),
        eq(onboardingWorkflowTemplates.isActive, true)
      )
    )
    .limit(1);

  return {
    ...toApiRecord(row as unknown as Record<string, unknown>),
    workflow_status: template?.status ?? "coming_soon",
    steps_backfilled: ensure.backfilled,
    steps: steps.map((s) => {
      const apiStep = toApiRecord(s as unknown as Record<string, unknown>);
      const merged = mergeStepResources(apiStep, row.hireType);
      return {
        ...merged,
        resources: resolveOnboardingVideoUrls(
          merged.resources as Parameters<typeof resolveOnboardingVideoUrls>[0]
        ),
      };
    }),
  };
}
