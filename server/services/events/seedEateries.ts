import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { eateries } from "../../db/schema/index.js";
import { EATERY_SEED } from "./eateriesSeed.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/** Seed the food-tour restaurant catalog. Idempotent. */
export async function seedEateries(): Promise<{ upserted: number }> {
  const db = requireDb();
  let upserted = 0;

  for (const row of EATERY_SEED) {
    let existing = null;

    const [bySeedKey] = await db
      .select()
      .from(eateries)
      .where(eq(eateries.seedKey, row.seedKey))
      .limit(1);
    existing = bySeedKey ?? null;

    if (!existing) {
      const [byName] = await db
        .select()
        .from(eateries)
        .where(eq(eateries.name, row.name))
        .limit(1);
      existing = byName ?? null;
    }

    const values = {
      name: row.name,
      address: row.address,
      timeLabel: row.timeLabel,
      orderMode: row.orderMode,
      orderLines: row.orderLines,
      drinkOption: row.drinkOption,
      orderKeyDishes: row.orderKeyDishes,
      notes: row.notes,
      seedKey: row.seedKey,
      sortOrder: row.sortOrder,
      isActive: true,
    };

    if (existing) {
      await db
        .update(eateries)
        .set({ ...values, updatedDate: new Date() })
        .where(eq(eateries.id, existing.id));
    } else {
      await db.insert(eateries).values(values);
    }
    upserted += 1;
  }

  return { upserted };
}
