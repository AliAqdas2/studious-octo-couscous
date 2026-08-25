import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  eventWorkflowTaskDefs,
  eventWorkflowTemplates,
  eventTemplates,
  events,
  roleAssignments,
  tasks,
} from "../../db/schema/index.js";
import type { WorkflowResourceLink } from "../../db/schema/event-workflow-task-defs.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { toApiRecord } from "../entities/serialize.js";
import { postSystemMessage } from "../tasks/postSystemMessage.js";
import { ensureEventInventoryChecklist } from "./eventInventory.js";
import { advanceEventStageIfDue } from "./advanceEventStage.js";
import { computeWorkflowDueDate } from "./workflowDueDate.js";
import { getEventOpsFeatures } from "./eventOpsSettings.js";
import {
  FEATURE_CONDITIONAL_MAP,
  type EventOpsFeatures,
} from "./eventOpsFeatures.js";
import {
  experienceKeyForEventType as matrixExperienceKey,
  getExperienceRow,
} from "./experienceMatrix.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

type ResponsibleRole =
  | "Admin"
  | "Sales"
  | "Ops"
  | "Chef"
  | "Event Host"
  | "Finance"
  | "Marketing";

type TaskCategory = "Pre-Event" | "Event-Day" | "Post-Event" | "Checklist";

type WorkflowPhase =
  | "upon_deposit"
  | "two_point_five_weeks"
  | "ros"
  | "three_weeks"
  | "two_weeks"
  | "one_week_before"
  | "staff_checkin_72_48h"
  | "twenty_four_h"
  | "during"
  | "post";

interface WorkflowTaskDef {
  title: string;
  role: string;
  daysBefore?: number;
  daysAfter?: number;
  category?: string;
  conditional?: string;
  description?: string;
  phase?: WorkflowPhase;
  dueAnchor?: "event_date" | "deposit_date" | "immediate";
  dueOffsetDays?: number;
  sortOrder?: number;
  resourceLinks?: WorkflowResourceLink[];
  traceId?: string | null;
  taskDefId?: string;
  conditionalJson?: Record<string, unknown>;
}

interface WorkflowDef {
  preEvent: WorkflowTaskDef[];
  dayOf: WorkflowTaskDef[];
  postEvent: WorkflowTaskDef[];
  inventory: string[];
  templateId?: string;
  fromDbTemplate?: boolean;
}

function mapRole(role: string): ResponsibleRole {
  if (role === "Guide" || role === "Host" || role === "Instructor") {
    return "Event Host";
  }
  if (role === "Marketing") return "Marketing";
  const allowed: ResponsibleRole[] = [
    "Admin",
    "Sales",
    "Ops",
    "Chef",
    "Event Host",
    "Finance",
    "Marketing",
  ];
  if (allowed.includes(role as ResponsibleRole)) {
    return role as ResponsibleRole;
  }
  return "Ops";
}

function mapCategory(raw: string | undefined, fallback: TaskCategory): TaskCategory {
  if (raw === "Event-Day" || raw === "Post-Event" || raw === "Checklist" || raw === "Pre-Event") {
    return raw;
  }
  return fallback;
}

function phaseToCategory(phase: WorkflowPhase): TaskCategory {
  if (phase === "during") return "Event-Day";
  if (phase === "post") return "Post-Event";
  return "Pre-Event";
}

function experienceKeyForEventType(eventType: string): string | null {
  return matrixExperienceKey(eventType);
}

function getHardcodedWorkflow(
  eventType: string,
  event: {
    alcoholIncluded?: boolean | null;
    shippingRequired?: boolean | null;
    transportationNeeded?: boolean | null;
  }
): WorkflowDef {
  const isVirtual = eventType.includes("Virtual");

  const baseWorkflow: Record<string, { preEvent: WorkflowTaskDef[]; inventory: string[] }> = {
    "In-Person Mixology": {
      preEvent: [
        { title: "Confirm cocktail ingredients and alcohol preferences", role: "Ops", daysBefore: 21 },
        { title: "Order cocktail supplies (Sterno, cups, ingredients)", role: "Ops", daysBefore: 14 },
        { title: "Reserve loading dock and confirm venue access", role: "Ops", daysBefore: 14 },
        {
          title: "Confirm transportation arrangements",
          role: "Sales",
          daysBefore: 7,
          conditional: "transportation_needed",
        },
      ],
      inventory: [
        "Sterno/Butane",
        "Cocktail Ingredients",
        "Cups",
        "Napkins",
        "Tablecloths",
        "Activity Sheets",
        "Pens",
      ],
    },
    "In-Person Private Monuments": {
      preEvent: [
        { title: "Confirm monument route and timing", role: "Event Host", daysBefore: 14 },
        { title: "Check accessibility requirements for participants", role: "Ops", daysBefore: 7 },
        {
          title: "Confirm transportation pickup/dropoff",
          role: "Ops",
          daysBefore: 3,
          conditional: "transportation_needed",
        },
      ],
      inventory: ["Activity Sheets", "Pens", "Bottled Water", "Snacks (optional)"],
    },
    "In-Person Paint & Sip": {
      preEvent: [
        { title: "Order canvases, easels, and paint supplies", role: "Ops", daysBefore: 14 },
        { title: "Confirm wine/beverage selections", role: "Sales", daysBefore: 7 },
        { title: "Reserve venue and confirm table setup", role: "Ops", daysBefore: 7 },
      ],
      inventory: [
        "Canvases",
        "Easels",
        "Paint Supplies",
        "Aprons",
        "Wine/Beverages",
        "Cups",
        "Napkins",
        "Tablecloths",
      ],
    },
    "In-Person Private Food Tour": {
      preEvent: [
        { title: "Confirm restaurant reservations (3-4 stops)", role: "Guide", daysBefore: 14 },
        { title: "Verify dietary restrictions with restaurants", role: "Ops", daysBefore: 7 },
        { title: "Send food tour itinerary to client", role: "Sales", daysBefore: 3 },
      ],
      inventory: ["Activity Sheets", "Pens", "Bottled Water"],
    },
    "In-Person Yoga & UnWined": {
      preEvent: [
        { title: "Confirm yoga instructor and wine pairing vendor", role: "Ops", daysBefore: 21 },
        { title: "Reserve yoga space and confirm setup requirements", role: "Ops", daysBefore: 14 },
        { title: "Order wine and snacks", role: "Ops", daysBefore: 7 },
      ],
      inventory: ["Yoga Mats (if needed)", "Wine", "Snacks", "Cups", "Napkins"],
    },
    "Virtual Mixology": {
      preEvent: [
        { title: "Begin kit-making (cocktail ingredients)", role: "Ops", daysBefore: 14 },
        { title: "Ship kits and confirm tracking codes", role: "Ops", daysBefore: 10 },
        { title: "Send Zoom link and instructions to participants", role: "Sales", daysBefore: 3 },
        { title: "Test virtual platform and screen sharing", role: "Host", daysBefore: 1 },
      ],
      inventory: [
        "JMark Kits",
        "Cocktail Ingredients",
        "Activity Sheets",
        "Shipping Boxes",
        "Bubble Wrap",
      ],
    },
    "Virtual Paint & Sip": {
      preEvent: [
        { title: "Begin kit-making (canvases, paint, brushes)", role: "Ops", daysBefore: 14 },
        { title: "Wrap canvases in bubble wrap for shipping", role: "Ops", daysBefore: 12 },
        { title: "Ship kits and confirm tracking codes", role: "Ops", daysBefore: 10 },
        { title: "Send Zoom link and instructions to participants", role: "Sales", daysBefore: 3 },
        { title: "Test virtual platform and screen sharing", role: "Host", daysBefore: 1 },
      ],
      inventory: [
        "Canvases",
        "Paint Supplies",
        "Brushes",
        "Activity Sheets",
        "Shipping Boxes",
        "Bubble Wrap",
        "JMark Kits",
      ],
    },
  };

  void event.alcoholIncluded;
  void event.shippingRequired;

  const commonPreEventTasks: WorkflowTaskDef[] = [
    {
      title: "Confirm deposit received and create Fareharbor item",
      role: "Sales",
      daysBefore: 999,
      category: "Upon Deposit",
    },
    {
      title: "Create BEO shell in shared drive",
      role: "Ops",
      daysBefore: 999,
      category: "Upon Deposit",
    },
    { title: "Assign Instructor/Guide/Host", role: "Admin", daysBefore: 21 },
    { title: "Confirm staff availability within 48 hours", role: "Ops", daysBefore: 21 },
    { title: "Finalize client details (time, date, location)", role: "Sales", daysBefore: 14 },
    { title: "Confirm number of attendees", role: "Sales", daysBefore: 7 },
    { title: "Send BEO to all assigned staff", role: "Ops", daysBefore: 3 },
    { title: "Triple-check inventory and order any missing items", role: "Ops", daysBefore: 3 },
    { title: "Hold pre-event staff call to review workflow", role: "Admin", daysBefore: 2 },
  ];

  const dayOfTasks: WorkflowTaskDef[] = [
    { title: "Host manages flow of event", role: "Event Host" },
    { title: "Instructor/Guide executes content", role: "Event Host" },
    { title: "Track drinks/food consumption", role: "Ops" },
    { title: "Take photos and upload to digital database", role: "Ops" },
    { title: "Ensure all materials and supplies are ready", role: "Ops" },
  ];
  if (isVirtual) {
    dayOfTasks.push({
      title: "Toggle participant screens as needed",
      role: "Event Host",
    });
  }

  const postEventTasks: WorkflowTaskDef[] = [
    { title: "Collect and upload photos to Drive", role: "Ops", daysAfter: 1 },
    { title: "Send follow-up email with photos", role: "Sales", daysAfter: 1 },
    { title: "Request referrals and LinkedIn connections", role: "Sales", daysAfter: 2 },
    { title: "Staff submit hours and invoices", role: "Event Host", daysAfter: 3 },
    { title: "Document P&L (labor, supplies, venue fees)", role: "Admin", daysAfter: 5 },
    { title: "CEO follow-up (if VIP or high-value client)", role: "Admin", daysAfter: 7 },
  ];

  const eventWorkflow = baseWorkflow[eventType] || { preEvent: [], inventory: [] };

  return {
    preEvent: [...commonPreEventTasks, ...eventWorkflow.preEvent],
    dayOf: dayOfTasks,
    postEvent: postEventTasks,
    inventory: eventWorkflow.inventory || [],
  };
}

function parseTemplateTasks(
  raw: unknown,
  fallbackCategory: TaskCategory
): WorkflowTaskDef[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowTaskDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const title = String(t.title || "").trim();
    if (!title) continue;
    out.push({
      title,
      role: String(t.responsible_role || t.responsibleRole || t.role || "Ops"),
      daysBefore:
        typeof t.days_before_event === "number"
          ? t.days_before_event
          : typeof t.daysBefore === "number"
            ? t.daysBefore
            : undefined,
      daysAfter:
        typeof t.days_after_event === "number"
          ? t.days_after_event
          : typeof t.daysAfter === "number"
            ? t.daysAfter
            : undefined,
      category: String(t.category || fallbackCategory),
      description:
        typeof t.description === "string" ? t.description : undefined,
      conditional:
        typeof t.conditional === "string" ? t.conditional : undefined,
    });
  }
  return out;
}

async function resolveDbExperienceWorkflow(
  event: typeof events.$inferSelect
): Promise<WorkflowDef | null> {
  const db = requireDb();
  const experienceKey =
    experienceKeyForEventType(event.eventType) ||
    (event.workflowTemplateId ? null : null);

  let template =
    event.workflowTemplateId != null
      ? (
          await db
            .select()
            .from(eventWorkflowTemplates)
            .where(eq(eventWorkflowTemplates.id, event.workflowTemplateId))
            .limit(1)
        )[0]
      : undefined;

  // If event type changed, ignore stale template id and resolve by experience key
  if (
    template &&
    experienceKey &&
    template.experienceKey !== experienceKey
  ) {
    template = undefined;
  }

  if (!template && experienceKey) {
    const [byKey] = await db
      .select()
      .from(eventWorkflowTemplates)
      .where(
        and(
          eq(eventWorkflowTemplates.experienceKey, experienceKey),
          eq(eventWorkflowTemplates.isActive, true)
        )
      )
      .orderBy(asc(eventWorkflowTemplates.version))
      .limit(1);
    template = byKey;
  }

  if (!template) return null;

  const defs = await db
    .select()
    .from(eventWorkflowTaskDefs)
    .where(eq(eventWorkflowTaskDefs.templateId, template.id))
    .orderBy(asc(eventWorkflowTaskDefs.sortOrder));

  if (defs.length === 0) return null;

  const preEvent: WorkflowTaskDef[] = [];
  const dayOf: WorkflowTaskDef[] = [];
  const postEvent: WorkflowTaskDef[] = [];

  for (const def of defs) {
    const mapped: WorkflowTaskDef = {
      title: def.title,
      role: def.role,
      description: def.description ?? undefined,
      phase: def.phase,
      dueAnchor: def.dueAnchor,
      dueOffsetDays: def.dueOffsetDays,
      sortOrder: def.sortOrder,
      resourceLinks: (def.resourceLinks as WorkflowResourceLink[] | null) ?? [],
      traceId: def.traceId,
      taskDefId: def.id,
      conditionalJson: (def.conditional as Record<string, unknown> | null) ?? {},
      conditional:
        typeof (def.conditional as Record<string, unknown> | null)?.if === "string"
          ? String((def.conditional as Record<string, unknown>).if)
          : undefined,
    };

    const cat = phaseToCategory(def.phase);
    if (cat === "Event-Day") dayOf.push(mapped);
    else if (cat === "Post-Event") postEvent.push(mapped);
    else preEvent.push(mapped);
  }

  return {
    preEvent,
    dayOf,
    postEvent,
    inventory: [],
    templateId: template.id,
    fromDbTemplate: true,
  };
}

async function resolveWorkflow(
  event: typeof events.$inferSelect
): Promise<WorkflowDef> {
  const db = requireDb();

  const fromExperience = await resolveDbExperienceWorkflow(event);
  if (fromExperience) return fromExperience;

  if (event.templateId) {
    const [byId] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, event.templateId))
      .limit(1);
    if (byId) {
      const pre = parseTemplateTasks(byId.preEventTasks, "Pre-Event");
      const day = parseTemplateTasks(byId.eventDayTasks, "Event-Day");
      const post = parseTemplateTasks(byId.postEventTasks, "Post-Event");
      if (pre.length || day.length || post.length) {
        return { preEvent: pre, dayOf: day, postEvent: post, inventory: [] };
      }
    }
  }

  const [byType] = await db
    .select()
    .from(eventTemplates)
    .where(
      and(
        eq(eventTemplates.eventType, event.eventType),
        eq(eventTemplates.isActive, true)
      )
    )
    .limit(1);
  if (byType) {
    const pre = parseTemplateTasks(byType.preEventTasks, "Pre-Event");
    const day = parseTemplateTasks(byType.eventDayTasks, "Event-Day");
    const post = parseTemplateTasks(byType.postEventTasks, "Post-Event");
    if (pre.length || day.length || post.length) {
      return { preEvent: pre, dayOf: day, postEvent: post, inventory: [] };
    }
  }

  return getHardcodedWorkflow(event.eventType, {
    alcoholIncluded: event.alcoholIncluded,
    shippingRequired: event.shippingRequired,
    transportationNeeded: event.transportationNeeded,
  });
}

function conditionMet(
  def: WorkflowTaskDef,
  event: typeof events.$inferSelect,
  features: EventOpsFeatures
): boolean {
  const conditional = def.conditional;
  const fromJson =
    typeof def.conditionalJson?.if === "string"
      ? String(def.conditionalJson.if)
      : null;
  const fromObj =
    conditional &&
    typeof conditional === "object" &&
    typeof (conditional as Record<string, unknown>).if === "string"
      ? String((conditional as Record<string, unknown>).if)
      : null;
  const jsonIf =
    typeof conditional === "string" ? conditional : fromObj || fromJson;

  if (jsonIf && FEATURE_CONDITIONAL_MAP[jsonIf]) {
    return Boolean(features[FEATURE_CONDITIONAL_MAP[jsonIf]]);
  }

  if (jsonIf === "thank_you_v2_yes") {
    return false;
  }
  if (jsonIf === "transportation_needed") {
    return Boolean(event.transportationNeeded);
  }

  if (!conditional) {
    return true;
  }

  if (typeof conditional === "object") {
    // Non-if conditionals (assigneeOptions etc.) do not gate creation
    return true;
  }

  if (typeof conditional === "string") {
    const camel = conditional.replace(/_([a-z])/g, (_, c: string) =>
      c.toUpperCase()
    );
    const val = (event as Record<string, unknown>)[camel];
    return Boolean(val);
  }
  return true;
}

function computeDueDate(
  def: WorkflowTaskDef,
  event: typeof events.$inferSelect,
  fallback: "pre" | "day" | "post"
): Date {
  return computeWorkflowDueDate(
    {
      phase: def.phase,
      dueAnchor: def.dueAnchor,
      dueOffsetDays: def.dueOffsetDays,
      daysBefore: def.daysBefore,
      daysAfter: def.daysAfter,
    },
    event,
    fallback
  );
}

export async function generateEventWorkflow(
  eventId: string,
  user?: AuthUser | null
) {
  if (!eventId) throw new AppError("eventId is required", 400);

  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), ne(tasks.category, "Checklist")));
  if (existing.length > 0) {
    throw new AppError("Workflow already generated for this event", 409);
  }

  const [adminAssignment] = await db
    .select()
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.role, "Admin"),
        eq(roleAssignments.userEmail, "admin2@mangiadc.com"),
        eq(roleAssignments.isActive, true)
      )
    )
    .limit(1);
  const defaultAdminUserId = adminAssignment?.userId || null;

  const workflow = await resolveWorkflow(event);
  const { features: opsFeatures } = await getEventOpsFeatures();
  const createdRows: (typeof tasks.$inferSelect)[] = [];

  const insertTask = async (
    def: WorkflowTaskDef,
    category: TaskCategory,
    dueDate: Date
  ) => {
    if (!conditionMet(def, event, opsFeatures)) return;
    const role = mapRole(def.role);
    const isAdminTask = role === "Admin";
    const [row] = await db
      .insert(tasks)
      .values({
        eventId,
        title: def.title,
        description: def.description || null,
        category: mapCategory(def.category, category),
        responsibleRole: role,
        dueDate,
        order: def.sortOrder ?? null,
        workflowPhase: def.phase ?? null,
        workflowTaskDefId: def.taskDefId ?? null,
        traceId: def.traceId ?? null,
        resourceLinks: def.resourceLinks ?? [],
        workflowMeta:
          def.conditionalJson && Object.keys(def.conditionalJson).length > 0
            ? {
                ...(Array.isArray(def.conditionalJson.assigneeOptions)
                  ? { assigneeOptions: def.conditionalJson.assigneeOptions }
                  : {}),
                ...(Array.isArray(def.conditionalJson.supplyPickupMethods)
                  ? {
                      supplyPickupMethods:
                        def.conditionalJson.supplyPickupMethods,
                    }
                  : {}),
                ...(def.traceId === "C038" ||
                def.traceId === "C039" ||
                def.traceId === "C040"
                  ? { staffStatus: "awaiting" as const }
                  : {}),
              }
            : {},
        status:
          isAdminTask && defaultAdminUserId
            ? "Working On It"
            : "Not Acknowledged",
        ...(isAdminTask && defaultAdminUserId
          ? {
              assignedUser: defaultAdminUserId,
              acknowledgedTimestamp: new Date(),
            }
          : {}),
      })
      .returning();
    if (row) createdRows.push(row);
  };

  for (const task of workflow.preEvent) {
    await insertTask(task, "Pre-Event", computeDueDate(task, event, "pre"));
  }

  for (const task of workflow.dayOf) {
    await insertTask(task, "Event-Day", computeDueDate(task, event, "day"));
  }

  for (const task of workflow.postEvent) {
    await insertTask(task, "Post-Event", computeDueDate(task, event, "post"));
  }

  if (workflow.templateId) {
    await db
      .update(events)
      .set({ workflowTemplateId: workflow.templateId, updatedDate: new Date() })
      .where(eq(events.id, eventId));
  }

  let inventoryCreated = 0;
  const inventoryExperienceKey =
    experienceKeyForEventType(event.eventType) || event.eventType;
  if (inventoryExperienceKey) {
    try {
      const inv = await ensureEventInventoryChecklist(
        eventId,
        inventoryExperienceKey
      );
      inventoryCreated = inv.created;
    } catch (err) {
      console.warn(
        "[generateEventWorkflow] ensureEventInventoryChecklist failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  await advanceEventStageIfDue(eventId);

  const now = new Date();
  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Workflow Generated",
    details: {
      event_type: event.eventType,
      tasks_created: createdRows.length,
      inventory_items: inventoryCreated || workflow.inventory.length,
      from_db_template: Boolean(workflow.fromDbTemplate),
      workflow_template_id: workflow.templateId ?? null,
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: now,
  });

  if (user?.id) {
    try {
      await postSystemMessage(
        {
          eventId,
          action: "tasks_generated",
          metadata: { task_count: createdRows.length },
        },
        user
      );
    } catch (err) {
      console.warn(
        "[generateEventWorkflow] postSystemMessage failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    success: true,
    tasksCreated: createdRows.length,
    inventory: workflow.inventory,
    inventoryChecklistCreated: inventoryCreated,
    fromDbTemplate: Boolean(workflow.fromDbTemplate),
    workflowTemplateId: workflow.templateId ?? null,
    experience: getExperienceRow(event.eventType) || null,
    tasks: createdRows.map((r) => toApiRecord(r as Record<string, unknown>)),
  };
}

/**
 * Delete open (non-Done) workflow tasks and regenerate from the current
 * event type's template. Requires confirm=true (plan 07).
 */
export async function regenerateEventWorkflow(
  eventId: string,
  user?: AuthUser | null,
  options?: { confirm?: boolean }
) {
  if (!options?.confirm) {
    throw new AppError(
      "Regenerating the workflow deletes open tasks. Pass confirm=true to proceed.",
      400
    );
  }
  if (!eventId) throw new AppError("eventId is required", 400);

  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const openTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.eventId, eventId),
        ne(tasks.category, "Checklist"),
        ne(tasks.status, "Done")
      )
    );

  const deletedIds: string[] = [];
  for (const t of openTasks) {
    await db.delete(tasks).where(eq(tasks.id, t.id));
    deletedIds.push(t.id);
  }

  // Clear template so resolve picks by current experience key
  await db
    .update(events)
    .set({ workflowTemplateId: null, updatedDate: new Date() })
    .where(eq(events.id, eventId));

  const remaining = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), ne(tasks.category, "Checklist")));

  // If Done tasks remain, generateEventWorkflow would 409 — remove only
  // blockers by allowing generate when no open tasks; if Done remain, still 409.
  // Plan: regenerating open tasks from new template. Keep Done history.
  // So we need generate to allow when only Done tasks exist.
  let result;
  if (remaining.length > 0) {
    // Temporarily bypass by inserting via internal path: delete check
    // Use force generate helper
    result = await generateEventWorkflowForce(eventId, user);
  } else {
    result = await generateEventWorkflow(eventId, user);
  }

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Workflow Regenerated",
    details: {
      deleted_open_tasks: deletedIds.length,
      event_type: event.eventType,
      experience: getExperienceRow(event.eventType)?.experienceKey ?? null,
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: new Date(),
  });

  return {
    ...result,
    deletedOpenTasks: deletedIds.length,
    regenerated: true,
  };
}

/** Like generateEventWorkflow but skips the "already generated" guard. */
async function generateEventWorkflowForce(
  eventId: string,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  // Mark existing Done workflow tasks so we don't duplicate titles — leave them.
  // Insert only missing template tasks by running resolve + insert with skip-if-title-exists.
  const [adminAssignment] = await db
    .select()
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.role, "Admin"),
        eq(roleAssignments.userEmail, "admin2@mangiadc.com"),
        eq(roleAssignments.isActive, true)
      )
    )
    .limit(1);
  const defaultAdminUserId = adminAssignment?.userId || null;

  const workflow = await resolveWorkflow(event);
  const { features: opsFeatures } = await getEventOpsFeatures();
  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), ne(tasks.category, "Checklist")));
  const existingTitles = new Set(existing.map((t) => t.title));
  const existingTraces = new Set(
    existing.map((t) => t.traceId).filter(Boolean) as string[]
  );

  const createdRows: (typeof tasks.$inferSelect)[] = [];

  const insertTask = async (
    def: WorkflowTaskDef,
    category: TaskCategory,
    dueDate: Date
  ) => {
    if (!conditionMet(def, event, opsFeatures)) return;
    if (def.traceId && existingTraces.has(def.traceId)) return;
    if (existingTitles.has(def.title)) return;
    const role = mapRole(def.role);
    const isAdminTask = role === "Admin";
    const [row] = await db
      .insert(tasks)
      .values({
        eventId,
        title: def.title,
        description: def.description || null,
        category: mapCategory(def.category, category),
        responsibleRole: role,
        dueDate,
        order: def.sortOrder ?? null,
        workflowPhase: def.phase ?? null,
        workflowTaskDefId: def.taskDefId ?? null,
        traceId: def.traceId ?? null,
        resourceLinks: def.resourceLinks ?? [],
        workflowMeta: {},
        status:
          isAdminTask && defaultAdminUserId
            ? "Working On It"
            : "Not Acknowledged",
        ...(isAdminTask && defaultAdminUserId
          ? {
              assignedUser: defaultAdminUserId,
              acknowledgedTimestamp: new Date(),
            }
          : {}),
      })
      .returning();
    if (row) createdRows.push(row);
  };

  for (const task of workflow.preEvent) {
    await insertTask(task, "Pre-Event", computeDueDate(task, event, "pre"));
  }
  for (const task of workflow.dayOf) {
    await insertTask(task, "Event-Day", computeDueDate(task, event, "day"));
  }
  for (const task of workflow.postEvent) {
    await insertTask(task, "Post-Event", computeDueDate(task, event, "post"));
  }

  if (workflow.templateId) {
    await db
      .update(events)
      .set({ workflowTemplateId: workflow.templateId, updatedDate: new Date() })
      .where(eq(events.id, eventId));
  }

  const inventoryExperienceKey =
    experienceKeyForEventType(event.eventType) || event.eventType;
  if (inventoryExperienceKey) {
    try {
      await ensureEventInventoryChecklist(eventId, inventoryExperienceKey);
    } catch {
      /* ignore */
    }
  }

  return {
    success: true,
    tasksCreated: createdRows.length,
    inventory: workflow.inventory,
    fromDbTemplate: Boolean(workflow.fromDbTemplate),
    workflowTemplateId: workflow.templateId ?? null,
    experience: getExperienceRow(event.eventType) || null,
    tasks: createdRows.map((r) => toApiRecord(r as Record<string, unknown>)),
  };
}
