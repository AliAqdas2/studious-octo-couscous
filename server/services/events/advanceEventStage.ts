import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { events, tasks } from "../../db/schema/index.js";

const TERMINAL_STAGES = new Set([
  "Completed",
  "Lost",
  "Canceled",
  "Cancelled",
  "Post-Event",
  "Post-Event Processing",
]);

const PRE_EVENT_PHASES = [
  "upon_deposit",
  "two_point_five_weeks",
  "three_weeks",
  "two_weeks",
  "ros",
  "one_week_before",
  "staff_checkin_72_48h",
  "twenty_four_h",
] as const;

const PRE_EVENT_READY_FROM = new Set([
  "Deposit Received",
  "Planning",
  "Run Of Show Scheduled",
  "Pre-Event Planning",
  "Inventory Ordering",
  "Staff Confirmed",
  "72hr Final Check",
]);

const POST_EVENT_FROM = new Set([
  "In Progress",
  "Event Day",
  "Pre-Event Ready",
  "Run Of Show Scheduled",
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

/**
 * When all pre-event workflow tasks are Done and stage is still early,
 * advance to Pre-Event Ready. Safe no-op otherwise.
 */
export async function maybeAdvanceToPreEventReady(
  eventId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return false;
  if (!PRE_EVENT_READY_FROM.has(event.stage ?? "")) return false;

  const preTasks = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      category: tasks.category,
      workflowPhase: tasks.workflowPhase,
    })
    .from(tasks)
    .where(eq(tasks.eventId, eventId));

  const relevant = preTasks.filter(
    (t) =>
      t.category !== "Checklist" &&
      t.workflowPhase &&
      PRE_EVENT_PHASES.includes(
        t.workflowPhase as (typeof PRE_EVENT_PHASES)[number]
      )
  );
  if (relevant.length === 0) return false;

  const allDone = relevant.every(
    (t) => t.status === "Done" || t.status === "Completed"
  );
  if (!allDone) return false;

  await db
    .update(events)
    .set({ stage: "Pre-Event Ready", updatedDate: new Date() })
    .where(eq(events.id, eventId));
  console.log(
    `[advanceEventStage] Event ${eventId} → Pre-Event Ready (pre-event tasks done)`
  );
  return true;
}

/**
 * Move In Progress (or late pre) → Post-Event when post-event work starts.
 */
export async function maybeAdvanceToPostEvent(
  eventId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return false;
  if (!POST_EVENT_FROM.has(event.stage ?? "")) return false;

  await db
    .update(events)
    .set({ stage: "Post-Event", updatedDate: new Date() })
    .where(eq(events.id, eventId));
  console.log(`[advanceEventStage] Event ${eventId} → Post-Event`);
  return true;
}

/**
 * After a task status change: Pre-Event Ready if pre-event complete;
 * Post-Event if a `post` phase task is Done while still In Progress.
 */
export async function maybeAdvanceStageAfterTaskUpdate(
  eventId: string,
  opts?: { workflowPhase?: string | null; status?: string | null }
): Promise<void> {
  if (!eventId) return;
  try {
    await maybeAdvanceToPreEventReady(eventId);

    const status = opts?.status ?? "";
    const phase = opts?.workflowPhase ?? "";
    if (
      phase === "post" &&
      (status === "Done" || status === "Completed")
    ) {
      await maybeAdvanceToPostEvent(eventId);
    }
  } catch (err) {
    console.warn(
      "[advanceEventStage] maybeAdvanceStageAfterTaskUpdate failed:",
      err instanceof Error ? err.message : err
    );
  }
}
