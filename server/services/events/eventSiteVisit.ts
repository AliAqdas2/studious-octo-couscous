import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { events } from "../../db/schema/events.js";
import { activityLogs } from "../../db/schema/activity-logs.js";
import { toApiRecord } from "../entities/serialize.js";
import type { AuthUser } from "../auth/authService.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export interface SiteVisitPhoto {
  url: string;
  caption?: string | null;
}

export interface EventSiteVisitPayload {
  siteVisitDate?: string | null;
  siteVisitNotes?: string | null;
  siteVisitParking?: string | null;
  siteVisitContacts?: string | null;
  siteVisitPhotos?: SiteVisitPhoto[] | null;
}

function normalizePhotos(raw: unknown): SiteVisitPhoto[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: SiteVisitPhoto[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const url = String(
      (item as { url?: unknown }).url ?? ""
    ).trim();
    if (!url) continue;
    const captionRaw = (item as { caption?: unknown }).caption;
    const caption =
      captionRaw == null ? null : String(captionRaw).trim() || null;
    out.push({ url, caption });
  }
  return out;
}

function parseDate(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const d = new Date(String(value).trim());
  if (Number.isNaN(d.getTime())) {
    throw new AppError("siteVisitDate is invalid", 400);
  }
  return d;
}

export function siteVisitFromEvent(event: typeof events.$inferSelect) {
  return {
    siteVisitDate: event.siteVisitDate
      ? new Date(event.siteVisitDate).toISOString()
      : null,
    siteVisitNotes: event.siteVisitNotes ?? null,
    siteVisitParking: event.siteVisitParking ?? null,
    siteVisitContacts: event.siteVisitContacts ?? null,
    siteVisitPhotos: Array.isArray(event.siteVisitPhotos)
      ? event.siteVisitPhotos
      : [],
  };
}

export async function saveEventSiteVisit(
  eventId: string,
  payload: EventSiteVisitPayload,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const now = new Date();
  const nextDate =
    payload.siteVisitDate !== undefined
      ? parseDate(payload.siteVisitDate)
      : event.siteVisitDate;
  const nextNotes =
    payload.siteVisitNotes !== undefined
      ? String(payload.siteVisitNotes ?? "").trim() || null
      : event.siteVisitNotes;
  const nextParking =
    payload.siteVisitParking !== undefined
      ? String(payload.siteVisitParking ?? "").trim() || null
      : event.siteVisitParking;
  const nextContacts =
    payload.siteVisitContacts !== undefined
      ? String(payload.siteVisitContacts ?? "").trim() || null
      : event.siteVisitContacts;
  const nextPhotos =
    payload.siteVisitPhotos !== undefined
      ? normalizePhotos(payload.siteVisitPhotos)
      : event.siteVisitPhotos;

  const [updated] = await db
    .update(events)
    .set({
      siteVisitDate: nextDate,
      siteVisitNotes: nextNotes,
      siteVisitParking: nextParking,
      siteVisitContacts: nextContacts,
      siteVisitPhotos: nextPhotos,
      updatedDate: now,
    })
    .where(eq(events.id, eventId))
    .returning();

  await db.insert(activityLogs).values({
    entityType: "Event",
    entityId: eventId,
    action: "Event Site Visit Updated",
    details: {
      has_date: Boolean(nextDate),
      has_notes: Boolean(nextNotes),
      photo_count: Array.isArray(nextPhotos) ? nextPhotos.length : 0,
    },
    userId: user?.id || null,
    userName: user?.full_name || "System",
    timestamp: now,
  });

  const row = updated || event;
  return {
    success: true,
    event: toApiRecord(row as Record<string, unknown>),
    siteVisit: siteVisitFromEvent(row),
  };
}
