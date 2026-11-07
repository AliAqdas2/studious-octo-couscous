import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, events, leads } from "../../db/schema/index.js";
import type { AuthUser } from "../auth/authService.js";
import { rescheduleWorkflowTasks } from "./rescheduleWorkflowTasks.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Database is not configured");
  return db;
}

/** Extract HH:MM from a Date; null if midnight or invalid. */
export function startTimeFromDate(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (hh === "00" && mm === "00") return null;
  return `${hh}:${mm}`;
}

/** Combine event calendar date + optional HH:MM into a preferred_date Date. */
export function combineEventDateAndStartTime(
  eventDate: Date,
  startTime: string | null | undefined
): Date {
  const base = new Date(eventDate);
  if (Number.isNaN(base.getTime())) return base;

  const raw = String(startTime || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (Number.isFinite(h) && Number.isFinite(min)) {
      base.setHours(h, min, 0, 0);
      return base;
    }
  }
  // Keep time already on eventDate if no startTime
  return base;
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function normStart(s: string | null | undefined): string | null {
  const t = String(s || "").trim();
  return t || null;
}

async function logSync(input: {
  entityType: "Lead" | "Event";
  entityId: string;
  source: "lead" | "event";
  from: unknown;
  to: unknown;
  linkedId: string;
  user?: AuthUser | null;
}): Promise<void> {
  const db = requireDb();
  try {
    await db.insert(activityLogs).values({
      entityType: input.entityType,
      entityId: input.entityId,
      action: "Date/Time Synced",
      details: {
        source: input.source,
        from: input.from,
        to: input.to,
        linked_id: input.linkedId,
      },
      userId: input.user?.id || null,
      userName: input.user?.full_name || "System",
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn(
      "[syncLeadEventDateTime] activity log failed:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Push lead preferred_date onto the linked event (event_date + start_time).
 * No-op if already equal. Reschedules workflow tasks when the calendar date moves.
 */
export async function applyLeadPreferredDateToEvent(
  eventId: string,
  preferredDate: Date | string | null | undefined,
  opts?: { user?: AuthUser | null; skipReschedule?: boolean; leadId?: string }
): Promise<boolean> {
  if (!eventId || preferredDate == null || preferredDate === "") return false;
  const db = requireDb();
  const next = new Date(preferredDate);
  if (Number.isNaN(next.getTime())) return false;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return false;

  const nextStart = startTimeFromDate(next);
  const prevDate = event.eventDate ? new Date(event.eventDate) : null;
  const prevStart = normStart(event.startTime);

  if (sameInstant(prevDate, next) && prevStart === nextStart) {
    return false;
  }

  const fromSnapshot = {
    event_date: prevDate?.toISOString() ?? null,
    start_time: prevStart,
  };
  const toSnapshot = {
    event_date: next.toISOString(),
    start_time: nextStart,
  };

  await db
    .update(events)
    .set({
      eventDate: next,
      startTime: nextStart,
      updatedDate: new Date(),
    })
    .where(eq(events.id, eventId));

  if (!opts?.skipReschedule) {
    try {
      await rescheduleWorkflowTasks(eventId);
    } catch (err) {
      console.warn(
        "[syncLeadEventDateTime] rescheduleWorkflowTasks failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const leadId =
    opts?.leadId || event.leadId || event.sourceLeadId || null;
  await logSync({
    entityType: "Event",
    entityId: eventId,
    source: "lead",
    from: fromSnapshot,
    to: toSnapshot,
    linkedId: leadId || "",
    user: opts?.user,
  });
  if (leadId) {
    await logSync({
      entityType: "Lead",
      entityId: leadId,
      source: "lead",
      from: fromSnapshot,
      to: toSnapshot,
      linkedId: eventId,
      user: opts?.user,
    });
  }

  return true;
}

/**
 * Push event event_date + start_time onto the linked lead preferred_date.
 * No-op if already equal.
 */
export async function applyEventDateTimeToLead(
  leadId: string,
  input: {
    eventDate: Date | string | null | undefined;
    startTime?: string | null;
  },
  opts?: { user?: AuthUser | null; eventId?: string }
): Promise<boolean> {
  if (!leadId || input.eventDate == null || input.eventDate === "") return false;
  const db = requireDb();
  const eventDate = new Date(input.eventDate);
  if (Number.isNaN(eventDate.getTime())) return false;

  const nextPreferred = combineEventDateAndStartTime(
    eventDate,
    input.startTime
  );

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return false;

  const prev = lead.preferredDate ? new Date(lead.preferredDate) : null;
  if (sameInstant(prev, nextPreferred)) {
    return false;
  }

  const fromIso = prev?.toISOString() ?? null;
  const toIso = nextPreferred.toISOString();

  await db
    .update(leads)
    .set({
      preferredDate: nextPreferred,
      updatedDate: new Date(),
    })
    .where(eq(leads.id, leadId));

  const eventId =
    opts?.eventId ||
    lead.convertedToEventId ||
    lead.linkedEventId ||
    null;

  await logSync({
    entityType: "Lead",
    entityId: leadId,
    source: "event",
    from: fromIso,
    to: toIso,
    linkedId: eventId || "",
    user: opts?.user,
  });
  if (eventId) {
    await logSync({
      entityType: "Event",
      entityId: eventId,
      source: "event",
      from: fromIso,
      to: toIso,
      linkedId: leadId,
      user: opts?.user,
    });
  }

  return true;
}
