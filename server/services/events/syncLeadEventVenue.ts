import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { events, leads } from "../../db/schema/index.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export type VenueModeValue = "go_to_them" | "house_venue" | null;

/**
 * Keep lead.venue / lead.venueMode and event.venue / event.venueMode aligned
 * when the lead is linked to the event (or vice versa).
 */
export async function syncLeadEventVenue(input: {
  leadId?: string | null;
  eventId?: string | null;
  venue: string | null;
  venueMode?: VenueModeValue;
  /** Skip writing back to the side that originated the change. */
  skipLead?: boolean;
  skipEvent?: boolean;
}): Promise<void> {
  const db = requireDb();
  const venue = input.venue?.trim() || null;
  const venueMode = input.venueMode ?? null;
  const now = new Date();

  let leadId = input.leadId || null;
  let eventId = input.eventId || null;

  if (!leadId && eventId) {
    const [ev] = await db
      .select({ leadId: events.leadId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    leadId = ev?.leadId ?? null;
    if (!leadId) {
      const [byConverted] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.convertedToEventId, eventId))
        .limit(1);
      leadId = byConverted?.id ?? null;
    }
  }

  if (!eventId && leadId) {
    const [lead] = await db
      .select({
        convertedToEventId: leads.convertedToEventId,
        linkedEventId: leads.linkedEventId,
      })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    eventId = lead?.convertedToEventId || lead?.linkedEventId || null;
  }

  if (!input.skipLead && leadId) {
    await db
      .update(leads)
      .set({
        venue,
        venueMode,
        updatedDate: now,
      })
      .where(eq(leads.id, leadId));
  }

  if (!input.skipEvent && eventId) {
    await db
      .update(events)
      .set({
        venue,
        venueMode,
        updatedDate: now,
      })
      .where(eq(events.id, eventId));
  }
}
