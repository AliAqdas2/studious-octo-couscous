import { sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import {
  eventAttendees,
  eventEateryStops,
  eventInventoryItems,
} from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export type OpsPanelSideFlagRow = {
  hasInventory: boolean;
  attendeeCount: number;
  stopCount: number;
};

/**
 * Bulk side data for Event Progress panel completion
 * (inventory rows, attendees, food-tour stops).
 */
export async function getOpsPanelSideFlags(): Promise<
  Record<string, OpsPanelSideFlagRow>
> {
  const db = requireDb();

  const [invRows, attRows, stopRows] = await Promise.all([
    db
      .select({
        eventId: eventInventoryItems.eventId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(eventInventoryItems)
      .groupBy(eventInventoryItems.eventId),
    db
      .select({
        eventId: eventAttendees.eventId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(eventAttendees)
      .groupBy(eventAttendees.eventId),
    db
      .select({
        eventId: eventEateryStops.eventId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(eventEateryStops)
      .groupBy(eventEateryStops.eventId),
  ]);

  const byEvent: Record<string, OpsPanelSideFlagRow> = {};

  const ensure = (eventId: string) => {
    if (!byEvent[eventId]) {
      byEvent[eventId] = {
        hasInventory: false,
        attendeeCount: 0,
        stopCount: 0,
      };
    }
    return byEvent[eventId];
  };

  for (const row of invRows) {
    ensure(String(row.eventId)).hasInventory = Number(row.cnt) > 0;
  }
  for (const row of attRows) {
    ensure(String(row.eventId)).attendeeCount = Number(row.cnt) || 0;
  }
  for (const row of stopRows) {
    ensure(String(row.eventId)).stopCount = Number(row.cnt) || 0;
  }

  return byEvent;
}
