import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  onboardingWorkflowSteps,
  onboardingWorkflowTemplates,
} from "../../db/schema/index.js";
import {
  ESA_WORKFLOW_STEPS,
  JOB_ROLES,
  type JobRole,
} from "./constants.js";

async function upsertTemplate(params: {
  name: string;
  jobRole: JobRole;
  status: "ready" | "coming_soon";
}): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("Database not configured");

  const existing = await db
    .select()
    .from(onboardingWorkflowTemplates)
    .where(
      and(
        eq(onboardingWorkflowTemplates.jobRole, params.jobRole),
        eq(onboardingWorkflowTemplates.isActive, true)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(onboardingWorkflowTemplates)
      .set({
        name: params.name,
        status: params.status,
        updatedDate: new Date(),
      })
      .where(eq(onboardingWorkflowTemplates.id, existing[0].id));
    return existing[0].id;
  }

  const [row] = await db
    .insert(onboardingWorkflowTemplates)
    .values({
      name: params.name,
      jobRole: params.jobRole,
      status: params.status,
      version: 1,
      isActive: true,
    })
    .returning();

  if (!row) throw new Error(`Failed to insert template for ${params.jobRole}`);
  return row.id;
}

async function replaceEsaSteps(templateId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not configured");

  await db
    .delete(onboardingWorkflowSteps)
    .where(eq(onboardingWorkflowSteps.templateId, templateId));

  for (const step of ESA_WORKFLOW_STEPS) {
    await db.insert(onboardingWorkflowSteps).values({
      templateId,
      phase: step.phase,
      sortOrder: step.sortOrder,
      title: step.title,
      instructions: step.instructions,
      stepType: step.stepType,
      ownerRole: step.ownerRole,
      isGate: step.isGate,
      slaHours: step.slaHours ?? null,
      resources: step.resources,
    });
  }
}

export async function seedOnboardingWorkflows(): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("getDb() returned null");

  for (const role of JOB_ROLES) {
    if (role === "Event Support Associate") {
      const id = await upsertTemplate({
        name: "Event Support Associate — full onboarding",
        jobRole: role,
        status: "ready",
      });
      await replaceEsaSteps(id);
      console.log(
        `[seed-onboarding] ESA ready template id=${id} steps=${ESA_WORKFLOW_STEPS.length}`
      );
    } else {
      const id = await upsertTemplate({
        name: `${role} — coming soon`,
        jobRole: role,
        status: "coming_soon",
      });
      console.log(`[seed-onboarding] stub ${role} coming_soon id=${id}`);
    }
  }
}
