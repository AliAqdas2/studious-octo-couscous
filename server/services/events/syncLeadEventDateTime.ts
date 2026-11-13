import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { activityLogs, events, leads } from "../../db/schema/index.js";
import type { AuthUser } from "../auth/authService.js";
import {
  easternWallTimeToUtc,
  etDateParts,
  etStartTimeHm,
  etYmd,
  parseDateOnlyEt,
} from "../dates/easternTime.js";
import { rescheduleWorkflowTasks } from "./rescheduleWorkflowTasks.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Database is not configured");
  return db;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extract HH:MM from a Date in America/New_York; null if midnight or invalid. */
export function startTimeFromDate(d: Date): string | null {
  return etStartTimeHm(d);
}

/**
 * Combine event calendar date + optional HH:MM into a preferred_date Date
 * using America/New_York wall time.
 */
export function combineEventDateAndStartTime(
  eventDate: Date,
  startTime: string | null | undefined
): Date {
  const base = new Date(eventDate);
  if (Number.isNaN(base.getTime())) return base;

  const { year, month, day } = etDateParts(base);
  const ymd = `${year}-${pad2(month)}-${pad2(day)}`;

  const raw = String(startTime || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (Number.isFinite(h) && Number.isFinite(min)) {
      const combined = easternWallTimeToUtc(
        `${ymd}T${pad2(h)}:${pad2(min)}:00`
      );
      if (combined && !Number.isNaN(combined.getTime())) return combined;
    }
  }
  // Keep time already on eventDate if no startTime
  return base;
}

/**
 * Parse deposit/event date payload into an ET day-anchor Date.
 * Accepts YYYY-MM-DD or a full ISO instant.
 */
export function parseEventDateInput(
  raw: Date | string | null | undefined
): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseDateOnlyEt(s);
  }
  // Date-only with time stripped preference for T12 noon payloads
  const dateOnly = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly && /T12:00:00/.test(s) && !/[zZ]|[+-]\d{2}:?\d{2}/.test(s)) {
    return parseDateOnlyEt(dateOnly[1]!);
  }
  if (dateOnly && !s.includes("T")) {
    return parseDateOnlyEt(dateOnly[1]!);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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
  // Store event_date as the same ET wall instant as preferred_date
  const nextEventDate = next;
  const prevDate = event.eventDate ? new Date(event.eventDate) : null;
  const prevStart = normStart(event.startTime);

  const prevYmd = prevDate ? etYmd(prevDate) : null;
  const nextYmd = etYmd(nextEventDate);

  if (
    sameInstant(prevDate, nextEventDate) &&
    prevStart === nextStart
  ) {
    return false;
  }

  const fromSnapshot = {
    event_date: prevDate?.toISOString() ?? null,
    start_time: prevStart,
  };
  const toSnapshot = {
    event_date: nextEventDate.toISOString(),
    start_time: nextStart,
  };

  await db
    .update(events)
    .set({
      eventDate: nextEventDate,
      startTime: nextStart,
      updatedDate: new Date(),
    })
    .where(eq(events.id, eventId));

  if (!opts?.skipReschedule && prevYmd !== nextYmd) {
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
  const eventDate =
    input.eventDate instanceof Date
      ? input.eventDate
      : parseEventDateInput(input.eventDate) || new Date(input.eventDate);
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
