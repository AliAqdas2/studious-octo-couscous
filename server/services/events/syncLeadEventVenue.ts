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
 * Keep lead.venue / venueMode / venueAddress aligned with the linked event
 * (and vice versa).
 */
export async function syncLeadEventVenue(input: {
  leadId?: string | null;
  eventId?: string | null;
  venue: string | null;
  venueMode?: VenueModeValue;
  venueAddress?: string | null;
  /** Skip writing back to the side that originated the change. */
  skipLead?: boolean;
  skipEvent?: boolean;
}): Promise<void> {
  const db = requireDb();
  const venue = input.venue?.trim() || null;
  const venueMode = input.venueMode ?? null;
  const venueAddress =
    input.venueAddress !== undefined
      ? input.venueAddress?.trim() || null
      : undefined;
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
        ...(venueAddress !== undefined ? { venueAddress } : {}),
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
        ...(venueAddress !== undefined ? { venueAddress } : {}),
        updatedDate: now,
      })
      .where(eq(events.id, eventId));
  }
}
