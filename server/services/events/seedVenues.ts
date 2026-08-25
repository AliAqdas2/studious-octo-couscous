import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { venues } from "../../db/schema/index.js";
import { HOUSE_VENUES } from "./depositIntakeTypes.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/** Seed house venues from legacy HOUSE_VENUES (skips "Other"). Idempotent. */
export async function seedVenues(): Promise<{ upserted: number }> {
  const db = requireDb();
  let upserted = 0;
  let sortOrder = 0;

  for (const name of HOUSE_VENUES) {
    if (name === "Other") continue;
    sortOrder += 1;
    const [existing] = await db
      .select()
      .from(venues)
      .where(eq(venues.name, name))
      .limit(1);

    if (existing) {
      await db
        .update(venues)
        .set({
          sortOrder,
          isActive: true,
          updatedDate: new Date(),
        })
        .where(eq(venues.id, existing.id));
    } else {
      await db.insert(venues).values({
        name,
        sortOrder,
        isActive: true,
      });
    }
    upserted += 1;
  }

  return { upserted };
}
