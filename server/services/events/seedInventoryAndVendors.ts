import { eq, notInArray } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import { inventoryCatalogItems, vendors } from "../../db/schema/index.js";
import { INVENTORY_CATALOG } from "./inventoryCatalogSeed.js";
import { VENDOR_SEED } from "./vendorSeedData.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function mergeExperienceKeys(
  existing: string[] | null | undefined,
  seeded: string[]
): string[] {
  const current = Array.isArray(existing) ? existing : [];
  return [...new Set([...current, ...seeded])];
}

export interface SeedInventoryResult {
  vendorsUpserted: number;
  catalogUpserted: number;
  catalogDeactivated: number;
}

/**
 * Idempotent seed of Vendor Directory + Inventory Per Event catalog SKUs.
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

  const seededSkuKeys = INVENTORY_CATALOG.map((row) => row.skuKey);

  for (const row of INVENTORY_CATALOG) {
    const defaultVendorId = row.defaultVendorName
      ? vendorByName.get(row.defaultVendorName) ?? null
      : null;

    const [existing] = await db
      .select()
      .from(inventoryCatalogItems)
      .where(eq(inventoryCatalogItems.skuKey, row.skuKey))
      .limit(1);

    const experienceKeys = mergeExperienceKeys(
      existing?.experienceKeys,
      row.experienceKeys
    );

    if (existing) {
      await db
        .update(inventoryCatalogItems)
        .set({
          name: row.name,
          experienceKeys,
          section: row.section,
          parentSkuKey: row.parentSkuKey ?? null,
          quantityHint: row.quantityHint ?? null,
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
        experienceKeys: row.experienceKeys,
        section: row.section,
        parentSkuKey: row.parentSkuKey ?? null,
        quantityHint: row.quantityHint ?? null,
        defaultVendorId,
        purchaseLinks: row.purchaseLinks,
        notes: row.notes,
        sortOrder: row.sortOrder,
        isActive: true,
      });
    }
    catalogUpserted += 1;
  }

  let catalogDeactivated = 0;
  if (seededSkuKeys.length > 0) {
    const stale = await db
      .update(inventoryCatalogItems)
      .set({ isActive: false, updatedDate: new Date() })
      .where(notInArray(inventoryCatalogItems.skuKey, seededSkuKeys))
      .returning({ id: inventoryCatalogItems.id });
    catalogDeactivated = stale.length;
  }

  return { vendorsUpserted, catalogUpserted, catalogDeactivated };
}
