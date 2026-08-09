import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, tasks } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/**
 * Delete all tasks for an event (idempotent with FK cascade on event delete).
 * Logs how many were removed.
 */
export async function cleanupEventTasks(
  eventId: string
): Promise<{ success: boolean; deletedTasks: number }> {
  if (!eventId) throw new AppError("eventId is required", 400);

  const db = requireDb();
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.eventId, eventId));

  if (existing.length === 0) {
    return { success: true, deletedTasks: 0 };
  }

  await db.delete(tasks).where(eq(tasks.eventId, eventId));

  try {
    await db.insert(activityLogs).values({
      entityType: "Event",
      entityId: eventId,
      action: "Event Tasks Cleaned Up",
      details: { deleted_tasks: existing.length },
      userName: "System (Event Cleanup)",
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn(
      "[cleanupEventTasks] activity log failed:",
      err instanceof Error ? err.message : err
    );
  }

  return { success: true, deletedTasks: existing.length };
}
