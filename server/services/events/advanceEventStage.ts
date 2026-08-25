import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { events } from "../../db/schema/index.js";

const TERMINAL_STAGES = new Set([
  "Completed",
  "Lost",
  "Canceled",
  "Cancelled",
  "Post-Event",
  "Post-Event Processing",
]);

/**
 * Auto-advance to "In Progress" when now crosses eventDate (plan 01).
 * Does not move terminal / post-event stages backward.
 */
export async function advanceEventStageIfDue(eventId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return;

  if (TERMINAL_STAGES.has(event.stage ?? "")) return;
  if (event.stage === "In Progress" || event.stage === "Event Day") return;

  const eventDate = new Date(event.eventDate);
  if (Number.isNaN(eventDate.getTime())) return;
  if (Date.now() < eventDate.getTime()) return;

  await db
    .update(events)
    .set({ stage: "In Progress", updatedDate: new Date() })
    .where(eq(events.id, eventId));
}

/** Batch helper for list views — advances any due events. */
export async function advanceDueEventStages(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const db = getDb();
  if (!db) return;

  const rows = await db
    .select()
    .from(events)
    .where(inArray(events.id, eventIds));

  const now = Date.now();
  for (const event of rows) {
    if (TERMINAL_STAGES.has(event.stage ?? "")) continue;
    if (event.stage === "In Progress" || event.stage === "Event Day") continue;
    const eventDate = new Date(event.eventDate);
    if (Number.isNaN(eventDate.getTime()) || now < eventDate.getTime()) continue;
    await db
      .update(events)
      .set({ stage: "In Progress", updatedDate: new Date() })
      .where(eq(events.id, event.id));
  }
}
