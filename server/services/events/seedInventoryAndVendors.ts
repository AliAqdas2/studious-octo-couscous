import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { inventoryCatalogItems, vendors } from "../../db/schema/index.js";
import { COOKING_INVENTORY_CATALOG } from "./cookingInventoryCatalogSeed.js";
import { VENDOR_SEED } from "./vendorSeedData.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}
export interface SeedInventoryResult {
  vendorsUpserted: number;
  catalogUpserted: number;
}

/**
 * Idempotent seed of Vendor Directory cooking vendors + Cooking inventory SKUs.
 */
export async function seedInventoryAndVendors(): Promise<SeedInventoryResult> {
  const db = requireDb();
  let vendorsUpserted = 0;
  let catalogUpserted = 0;

  for (const row of VENDOR_SEED) {
    const [existing] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.name, row.name))
      .limit(1);

    if (existing) {
      await db
        .update(vendors)
        .set({
          category: row.category,
          phone: row.phone,
          email: row.email,
          address: row.address,
          website: row.website,
          notes: row.notes,
          usedFor: row.usedFor,
          isActive: true,
          updatedDate: new Date(),
        })
        .where(eq(vendors.id, existing.id));
    } else {
      await db.insert(vendors).values({
        name: row.name,
        category: row.category,
        phone: row.phone,
        email: row.email,
        address: row.address,
        website: row.website,
        notes: row.notes,
        usedFor: row.usedFor,
        isActive: true,
      });
    }
    vendorsUpserted += 1;
  }

  const vendorRows = await db.select().from(vendors);
  const vendorByName = new Map(
    vendorRows.map((v: typeof vendors.$inferSelect) => [v.name, v.id])
  );

  for (const row of COOKING_INVENTORY_CATALOG) {
    const defaultVendorId = row.defaultVendorName
      ? vendorByName.get(row.defaultVendorName) ?? null
      : null;

    const [existing] = await db
      .select()
      .from(inventoryCatalogItems)
      .where(eq(inventoryCatalogItems.skuKey, row.skuKey))
      .limit(1);

    const experienceKeys = [row.experienceKey];

    if (existing) {
      // Do not overwrite purchase_links — Settings / admin edits are source of truth after first seed.
      // Do not overwrite experience_keys if admin already expanded them.
      const existingKeys = Array.isArray(existing.experienceKeys)
        ? existing.experienceKeys
        : [];
      const mergedKeys =
        existingKeys.length > 0
          ? existingKeys
          : experienceKeys;
      await db
        .update(inventoryCatalogItems)
        .set({
          name: row.name,
          experienceKeys: mergedKeys,
          defaultVendorId,
          notes: row.notes,
          sortOrder: row.sortOrder,
          isActive: true,
          updatedDate: new Date(),
        })
        .where(eq(inventoryCatalogItems.id, existing.id));
    } else {
      await db.insert(inventoryCatalogItems).values({
        skuKey: row.skuKey,
        name: row.name,
        experienceKeys,
        defaultVendorId,
        purchaseLinks: row.purchaseLinks,
        notes: row.notes,
        sortOrder: row.sortOrder,
        isActive: true,
      });
    }
    catalogUpserted += 1;
  }

  return { vendorsUpserted, catalogUpserted };
}
