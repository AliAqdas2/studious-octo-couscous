import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, events, tasks } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuthUser } from "../auth/authService.js";
import { generateEventWorkflow } from "../events/generateWorkflow.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const EXPECTED_MIN_WORKFLOW_TASKS = 10;

export async function validateTaskSync() {
  const db = requireDb();
  const allEvents = await db.select().from(events);
  const allTasks = await db.select().from(tasks);

  const syncReport = {
    total_events: allEvents.length,
    events_missing_tasks: [] as Array<{
      event_id: string;
      event_name: string;
      event_date: string | null;
      event_type: string;
    }>,
    events_with_incomplete_tasks: [] as Array<{
      event_id: string;
      event_name: string;
      task_count: number;
      expected_min: number;
    }>,
    orphaned_tasks: [] as Array<{
      task_id: string;
      task_title: string;
      event_id: string;
    }>,
    healthy_events: 0,
    health_status: "HEALTHY" as "HEALTHY" | "NEEDS_ATTENTION",
  };

  const eventIds = new Set(allEvents.map((e) => e.id));

  for (const event of allEvents) {
    const eventTasks = allTasks.filter((t) => t.eventId === event.id);
    const workflowTasks = eventTasks.filter((t) => t.category !== "Checklist");

    if (workflowTasks.length === 0) {
      syncReport.events_missing_tasks.push({
        event_id: event.id,
        event_name: event.eventName,
        event_date: event.eventDate ? event.eventDate.toISOString() : null,
        event_type: event.eventType,
      });
    } else if (workflowTasks.length < EXPECTED_MIN_WORKFLOW_TASKS) {
      syncReport.events_with_incomplete_tasks.push({
        event_id: event.id,
        event_name: event.eventName,
        task_count: workflowTasks.length,
        expected_min: EXPECTED_MIN_WORKFLOW_TASKS,
      });
    } else {
      syncReport.healthy_events++;
    }
  }

  for (const task of allTasks) {
    if (!eventIds.has(task.eventId)) {
      syncReport.orphaned_tasks.push({
        task_id: task.id,
        task_title: task.title,
        event_id: task.eventId,
      });
    }
  }

  syncReport.health_status =
    syncReport.events_missing_tasks.length === 0 &&
    syncReport.orphaned_tasks.length === 0
      ? "HEALTHY"
      : "NEEDS_ATTENTION";

  return { success: true, report: syncReport };
}

export async function autoRepairTaskSync(eventId: string, user: AuthUser) {
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
    .where(eq(tasks.eventId, eventId));
  const workflowTasks = existing.filter((t) => t.category !== "Checklist");

  if (workflowTasks.length > 0) {
    return {
      success: false,
      message: "Event already has workflow tasks",
      task_count: workflowTasks.length,
    };
  }

  const result = await generateEventWorkflow(eventId, user);

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Auto-Repaired Task Sync",
    details: {
      event_name: event.eventName,
      tasks_created: result.tasksCreated,
      repaired_by: user.id,
    },
    userId: user.id,
    userName: user.full_name,
    timestamp: new Date(),
  });

  return {
    success: true,
    message: "Task sync repaired",
    tasks_created: result.tasksCreated,
  };
}

export async function countWorkflowTasks(eventId: string): Promise<number> {
  const db = requireDb();
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), ne(tasks.category, "Checklist")));
  return rows.length;
}
