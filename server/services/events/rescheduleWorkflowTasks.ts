import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  eventWorkflowTaskDefs,
  events,
  tasks,
} from "../../db/schema/index.js";
import { computeWorkflowDueDate } from "./workflowDueDate.js";

function requireDb() {
  const db = getDb();
  if (!db) return null;
  return db;
}

/**
 * When eventDate changes, recompute due dates for open workflow tasks
 * that are anchored to the event date (plan 03).
 */
export async function rescheduleWorkflowTasks(
  eventId: string
): Promise<{ updated: number }> {
  const db = requireDb();
  if (!db) return { updated: 0 };

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return { updated: 0 };

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

  if (openTasks.length === 0) return { updated: 0 };

  const defIds = openTasks
    .map((t) => t.workflowTaskDefId)
    .filter((id): id is string => Boolean(id));

  const defs =
    defIds.length === 0
      ? []
      : await db
          .select()
          .from(eventWorkflowTaskDefs)
          .where(inArray(eventWorkflowTaskDefs.id, defIds));

  const defById = new Map(defs.map((d) => [d.id, d]));
  let updated = 0;
  const now = new Date();

  for (const task of openTasks) {
    const def = task.workflowTaskDefId
      ? defById.get(task.workflowTaskDefId)
      : undefined;

    // Skip immediate/deposit-anchored tasks — they shouldn't move with event date
    if (def?.dueAnchor === "immediate" || def?.dueAnchor === "deposit_date") {
      continue;
    }

    const fallback =
      task.category === "Post-Event"
        ? "post"
        : task.category === "Event-Day"
          ? "day"
          : "pre";

    const nextDue = computeWorkflowDueDate(
      def
        ? {
            phase: def.phase,
            dueAnchor: def.dueAnchor,
            dueOffsetDays: def.dueOffsetDays,
          }
        : {
            phase: task.workflowPhase,
            dueAnchor: "event_date",
            dueOffsetDays:
              task.category === "Post-Event"
                ? 1
                : task.category === "Event-Day"
                  ? 0
                  : 7,
          },
      event,
      fallback
    );

    const prev = task.dueDate ? new Date(task.dueDate).getTime() : null;
    if (prev != null && Math.abs(prev - nextDue.getTime()) < 60_000) {
      continue;
    }

    await db
      .update(tasks)
      .set({ dueDate: nextDue, updatedDate: now })
      .where(eq(tasks.id, task.id));
    updated += 1;
  }

  return { updated };
}
