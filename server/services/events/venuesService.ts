import { asc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { venues } from "../../db/schema/index.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

export async function listActiveHouseVenueNames(): Promise<string[]> {
  const db = requireDb();
  const rows = await db
    .select({ name: venues.name })
    .from(venues)
    .where(eq(venues.isActive, true))
    .orderBy(asc(venues.sortOrder), asc(venues.name));
  return rows.map((r) => r.name);
}

export async function listActiveHouseVenues() {
  const db = requireDb();
  return db
    .select()
    .from(venues)
    .where(eq(venues.isActive, true))
    .orderBy(asc(venues.sortOrder), asc(venues.name));
}

/** Resolve venue_mode for a free-text venue name against the active catalog. */
export async function resolveVenueModeForName(
  venueName: string | null | undefined
): Promise<"house_venue" | "go_to_them" | null> {
  const name = (venueName || "").trim();
  if (!name) return null;
  const active = await listActiveHouseVenueNames();
  if (active.includes(name)) return "house_venue";
  return "go_to_them";
}
