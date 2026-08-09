import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  activityLogs,
  eventTemplates,
  events,
  roleAssignments,
  tasks,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { toApiRecord } from "../entities/serialize.js";
import { postSystemMessage } from "../tasks/postSystemMessage.js";

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
  | "Finance";

type TaskCategory = "Pre-Event" | "Event-Day" | "Post-Event" | "Checklist";

interface WorkflowTaskDef {
  title: string;
  role: string;
  daysBefore?: number;
  daysAfter?: number;
  category?: string;
  conditional?: string;
  description?: string;
}

interface WorkflowDef {
  preEvent: WorkflowTaskDef[];
  dayOf: WorkflowTaskDef[];
  postEvent: WorkflowTaskDef[];
  inventory: string[];
}

function mapRole(role: string): ResponsibleRole {
  if (role === "Guide" || role === "Host" || role === "Instructor") {
    return "Event Host";
  }
  const allowed: ResponsibleRole[] = [
    "Admin",
    "Sales",
    "Ops",
    "Chef",
    "Event Host",
    "Finance",
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
  // "Upon Deposit" and other Base44 labels → Pre-Event
  return fallback;
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

async function resolveWorkflow(
  event: typeof events.$inferSelect
): Promise<WorkflowDef> {
  const db = requireDb();

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
  conditional: string | undefined,
  event: typeof events.$inferSelect
): boolean {
  if (!conditional) return true;
  if (conditional === "transportation_needed") {
    return Boolean(event.transportationNeeded);
  }
  const camel = conditional.replace(/_([a-z])/g, (_, c: string) =>
    c.toUpperCase()
  );
  const val = (event as Record<string, unknown>)[camel];
  return Boolean(val);
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
  const eventDate = new Date(event.eventDate);
  const createdRows: (typeof tasks.$inferSelect)[] = [];

  const insertTask = async (
    def: WorkflowTaskDef,
    category: TaskCategory,
    dueDate: Date
  ) => {
    if (!conditionMet(def.conditional, event)) return;
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
    const dueDate = new Date(eventDate);
    dueDate.setDate(dueDate.getDate() - (task.daysBefore || 0));
    await insertTask(task, "Pre-Event", dueDate);
  }

  for (const task of workflow.dayOf) {
    await insertTask(task, "Event-Day", eventDate);
  }

  for (const task of workflow.postEvent) {
    const dueDate = new Date(eventDate);
    dueDate.setDate(dueDate.getDate() + (task.daysAfter || 0));
    await insertTask(task, "Post-Event", dueDate);
  }

  const now = new Date();
  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Workflow Generated",
    details: {
      event_type: event.eventType,
      tasks_created: createdRows.length,
      inventory_items: workflow.inventory.length,
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
    tasks: createdRows.map((r) => toApiRecord(r as Record<string, unknown>)),
  };
}
