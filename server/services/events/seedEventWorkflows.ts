import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  eventWorkflowTaskDefs,
  eventWorkflowTemplates,
} from "../../db/schema/index.js";
import {
  COOKING_DISPLAY_NAME,
  COOKING_EXPERIENCE_KEY,
  COOKING_TASK_DEFS,
  type CookingTaskDefSeed,
} from "./cookingWorkflowSeed.js";
import { assertCookingTraceCoverage } from "./cookingTraceTargets.js";
import { ALL_WORKFLOW_RESOURCE_LINKS } from "./workflowResources.js";
import { EXPERIENCE_MATRIX } from "./experienceMatrix.js";
import { buildExperienceTaskDefs } from "./experienceWorkflowSeed.js";

async function upsertTemplate(input: {
  experienceKey: string;
  displayName: string;
  timelineFamily: "A" | "B" | "C";
  docQuality: string;
  flagNote: string | null;
}): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("Database not configured");

  const existing = await db
    .select()
    .from(eventWorkflowTemplates)
    .where(
      and(
        eq(eventWorkflowTemplates.experienceKey, input.experienceKey),
        eq(eventWorkflowTemplates.version, 1),
        eq(eventWorkflowTemplates.isActive, true)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(eventWorkflowTemplates)
      .set({
        displayName: input.displayName,
        timelineFamily: input.timelineFamily,
        docQuality: input.docQuality,
        flagNote: input.flagNote,
        updatedDate: new Date(),
      })
      .where(eq(eventWorkflowTemplates.id, existing[0].id));
    return existing[0].id;
  }

  const [row] = await db
    .insert(eventWorkflowTemplates)
    .values({
      experienceKey: input.experienceKey,
      displayName: input.displayName,
      timelineFamily: input.timelineFamily,
      docQuality: input.docQuality,
      flagNote: input.flagNote,
      version: 1,
      isActive: true,
    })
    .returning();

  if (!row) throw new Error(`Failed to insert template ${input.experienceKey}`);
  return row.id;
}

async function replaceTaskDefs(
  templateId: string,
  defs: CookingTaskDefSeed[]
): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("Database not configured");

  await db
    .delete(eventWorkflowTaskDefs)
    .where(eq(eventWorkflowTaskDefs.templateId, templateId));

  for (const def of defs) {
    await db.insert(eventWorkflowTaskDefs).values({
      templateId,
      phase: def.phase,
      title: def.title,
      description: def.description ?? null,
      role: def.role,
      dueOffsetDays: def.dueOffsetDays,
      dueAnchor: def.dueAnchor,
      sortOrder: def.sortOrder,
      resourceLinks: def.resourceLinks ?? [],
      conditional: def.conditional ?? {},
      traceId: def.traceId,
    });
  }

  return defs.length;
}

/** Seed Cooking + all plan-07 experience templates. Idempotent. */
export async function seedEventWorkflows(): Promise<{
  templateId: string;
  taskDefCount: number;
  resourceCount: number;
  templatesSeeded: number;
  experienceResults: Array<{
    experienceKey: string;
    templateId: string;
    taskDefCount: number;
    docQuality: string;
  }>;
}> {
  const LOG = "[seed-event-workflows]";
  console.log(`${LOG} asserting cooking trace coverage…`);
  assertCookingTraceCoverage();

  const db = getDb();
  if (!db) throw new Error("getDb() returned null");

  console.log(`${LOG} upserting Cooking template…`);
  const cookingId = await upsertTemplate({
    experienceKey: COOKING_EXPERIENCE_KEY,
    displayName: COOKING_DISPLAY_NAME,
    timelineFamily: "A",
    docQuality: "complete",
    flagNote: null,
  });
  console.log(`${LOG} replacing Cooking task defs…`);
  const cookingTasks = await replaceTaskDefs(cookingId, COOKING_TASK_DEFS);
  console.log(`${LOG} Cooking done (${cookingTasks} tasks)`);

  const experienceResults: Array<{
    experienceKey: string;
    templateId: string;
    taskDefCount: number;
    docQuality: string;
  }> = [
    {
      experienceKey: COOKING_EXPERIENCE_KEY,
      templateId: cookingId,
      taskDefCount: cookingTasks,
      docQuality: "complete",
    },
  ];

  for (const row of EXPERIENCE_MATRIX) {
    if (row.timelineFamily === "A") continue;
    console.log(`${LOG} seeding ${row.experienceKey}…`);
    const defs = buildExperienceTaskDefs(row);
    const id = await upsertTemplate({
      experienceKey: row.experienceKey,
      displayName: row.displayName,
      timelineFamily: row.timelineFamily,
      docQuality: row.docQuality,
      flagNote: row.flagNote,
    });
    const count = await replaceTaskDefs(id, defs);
    console.log(`${LOG}   ${row.experienceKey}: ${count} tasks`);
    experienceResults.push({
      experienceKey: row.experienceKey,
      templateId: id,
      taskDefCount: count,
      docQuality: row.docQuality,
    });
  }

  return {
    templateId: cookingId,
    taskDefCount: cookingTasks,
    resourceCount: ALL_WORKFLOW_RESOURCE_LINKS.length,
    templatesSeeded: experienceResults.length,
    experienceResults,
  };
}
