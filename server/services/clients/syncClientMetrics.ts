import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { clients, events } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

const ACTIVE_STAGES = new Set([
  "Completed",
  "Deposit Received",
  "Planning",
  "Run Of Show Scheduled",
  "Pre-Event Ready",
  "In Progress",
  "Post-Event",
  // Legacy
  "Pre-Event Planning",
  "Inventory Ordering",
  "Staff Confirmed",
  "72hr Final Check",
  "Event Day",
  "Post-Event Processing",
]);

/**
 * Recompute Client metrics from linked events (Base44 syncClientMetrics).
 */
export async function syncClientMetrics(clientId: string): Promise<{
  success: boolean;
  metrics?: {
    total_events: number;
    lifetime_revenue: number;
    average_event_value: number;
  };
}> {
  if (!clientId) {
    throw new AppError("clientId is required", 400);
  }

  const db = requireDb();
  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.clientId, clientId));

  const confirmedEvents = allEvents.filter(
    (e) => e.stage && ACTIVE_STAGES.has(e.stage)
  );

  const totalEvents = confirmedEvents.length;
  const lifetimeRevenue = confirmedEvents.reduce(
    (sum, e) => sum + (e.totalCost || 0),
    0
  );
  const averageEventValue =
    totalEvents > 0 ? lifetimeRevenue / totalEvents : 0;

  const eventDates = confirmedEvents
    .filter((e) => e.eventDate)
    .map((e) => new Date(e.eventDate as Date))
    .sort((a, b) => a.getTime() - b.getTime());

  const firstEventDate = eventDates.length > 0 ? eventDates[0] : null;
  const lastEventDate =
    eventDates.length > 0 ? eventDates[eventDates.length - 1] : null;

  await db
    .update(clients)
    .set({
      totalEvents,
      lifetimeRevenue,
      averageEventValue,
      firstEventDate,
      lastEventDate,
      isReturning: totalEvents >= 1,
      updatedDate: new Date(),
    })
    .where(eq(clients.id, clientId));

  return {
    success: true,
    metrics: {
      total_events: totalEvents,
      lifetime_revenue: lifetimeRevenue,
      average_event_value: averageEventValue,
    },
  };
}
