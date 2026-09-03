import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { venues } from "../../db/schema/index.js";
import { VENUE_GUIDELINES_SEED } from "./venueGuidelinesSeed.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/**
 * Upsert venue guidelines HTML onto house venues by name.
 * Overwrites guidelines on re-seed. Skips venues that are not in DB.
 */
export async function seedVenueGuidelines(): Promise<{
  updated: number;
  skippedMissingVenue: number;
}> {
  const db = requireDb();
  let updated = 0;
  let skippedMissingVenue = 0;

  for (const row of VENUE_GUIDELINES_SEED) {
    const [existing] = await db
      .select()
      .from(venues)
      .where(eq(venues.name, row.venueName))
      .limit(1);

    if (!existing) {
      skippedMissingVenue += 1;
      continue;
    }

    await db
      .update(venues)
      .set({
        guidelines: row.html,
        updatedDate: new Date(),
      })
      .where(eq(venues.id, existing.id));
    updated += 1;
  }

  return { updated, skippedMissingVenue };
}
