import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  events,
  instructors,
  tasks,
  venueImages,
  venues,
} from "../../db/schema/index.js";
import type { AuthUser } from "../../types/auth.js";
import { toApiRecord } from "../entities/serialize.js";
import { redactDepositFields } from "./depositAccess.js";
import { getEventInventory } from "./eventInventory.js";
import { listEventEateryStops } from "./eateryStops.js";
import {
  getRosConfirmLabel,
  isFoodTourExperience,
} from "./experienceMatrix.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

async function markBeoTaskDone(eventId: string, note: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.eventId, eventId),
        inArray(tasks.traceId, ["C035"]),
        ne(tasks.status, "Done")
      )
    );
  const now = new Date();
  for (const t of rows) {
    await db
      .update(tasks)
      .set({
        status: "Done",
        completionTimestamp: now,
        progressNotes: [t.progressNotes, note].filter(Boolean).join("\n"),
        updatedDate: now,
      })
      .where(eq(tasks.id, t.id));
  }
}

async function loadVenueByName(name: string | null | undefined) {
  if (!name) return { venue: null, venueImages: [] as Record<string, unknown>[] };
  const db = requireDb();
  const [venue] = await db
    .select()
    .from(venues)
    .where(eq(venues.name, name))
    .limit(1);
  if (!venue) return { venue: null, venueImages: [] as Record<string, unknown>[] };

  const images = await db
    .select()
    .from(venueImages)
    .where(
      and(eq(venueImages.venueId, venue.id), eq(venueImages.isActive, true))
    )
    .orderBy(asc(venueImages.sortOrder));

  return {
    venue: toApiRecord(venue as Record<string, unknown>),
    venueImages: images.map((img) =>
      toApiRecord(img as Record<string, unknown>)
    ),
  };
}

async function loadInstructor(instructorId: string | null | undefined) {
  if (!instructorId) return null;
  const db = requireDb();
  const [row] = await db
    .select()
    .from(instructors)
    .where(eq(instructors.id, instructorId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
  };
}

export async function getBeoDocumentState(
  eventId: string,
  user?: AuthUser | null
) {
  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const ros =
    event.runOfShow && typeof event.runOfShow === "object"
      ? (event.runOfShow as Record<string, unknown>)
      : {};

  const rosInstructorId =
    (typeof ros.instructorId === "string" && ros.instructorId) ||
    event.instructorId ||
    null;

  const [{ venue, venueImages: images }, instructor, inventory, eateryStops] =
    await Promise.all([
      loadVenueByName(event.venue),
      loadInstructor(rosInstructorId),
      getEventInventory(eventId),
      listEventEateryStops(eventId),
    ]);

  const inventoryItems = Array.isArray(inventory?.items)
    ? inventory.items.filter(
        (item) => item && (item as { needed?: boolean }).needed !== false
      )
    : [];

  return {
    html: event.beoDocumentHtml || null,
    updatedAt: event.beoDocumentUpdatedAt
      ? event.beoDocumentUpdatedAt.toISOString()
      : null,
    hasDocument: Boolean(event.beoDocumentHtml?.trim()),
    beoUrl: event.beoUrl || null,
    rosCompleted: Boolean(ros.completedAt),
    rosScheduled: Boolean(ros.scheduledAt),
    rosConfirmLabel: getRosConfirmLabel(event.eventType),
    isFoodTour: isFoodTourExperience(event.eventType),
    event: redactDepositFields(
      toApiRecord(event as Record<string, unknown>),
      user
    ),
    runOfShow: ros,
    venue,
    venueImages: images,
    instructor,
    inventory: inventoryItems,
    eateryStops,
  };
}

export async function saveBeoDocument(
  eventId: string,
  html: string,
  user?: AuthUser | null
) {
  if (typeof html !== "string" || !html.trim()) {
    throw new AppError("BEO document HTML is required", 400);
  }
  if (html.length > 500_000) {
    throw new AppError("BEO document is too large", 400);
  }

  const db = requireDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError("Event not found", 404);

  const now = new Date();
  const [updated] = await db
    .update(events)
    .set({
      beoDocumentHtml: html,
      beoDocumentUpdatedAt: now,
      updatedDate: now,
    })
    .where(eq(events.id, eventId))
    .returning();

  await markBeoTaskDone(eventId, "Admin BEO document saved in CRM");

  return getBeoDocumentState(eventId, user).then((state) => ({
    ...state,
    event: redactDepositFields(
      toApiRecord((updated || event) as Record<string, unknown>),
      user
    ),
  }));
}
