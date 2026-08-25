import { and, asc, eq, sql } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getDb } from "../../db/index.js";
import {
  eventInventoryItems,
  inventoryCatalogItems,
  vendors,
} from "../../db/schema/index.js";
import { COOKING_EXPERIENCE_KEY } from "./cookingWorkflowSeed.js";
import { toApiRecord } from "../entities/serialize.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

async function catalogForExperience(experienceKey: string) {
  const db = requireDb();
  return db
    .select()
    .from(inventoryCatalogItems)
    .where(
      and(
        sql`${inventoryCatalogItems.experienceKeys} @> ${JSON.stringify([
          experienceKey,
        ])}::jsonb`,
        eq(inventoryCatalogItems.isActive, true)
      )
    )
    .orderBy(asc(inventoryCatalogItems.sortOrder));
}

/**
 * Copy matching catalog rows onto an event (idempotent).
 * When the experience has no own SKUs, fall back to the shared Cooking catalog.
 */
export async function ensureEventInventoryChecklist(
  eventId: string,
  experienceKey: string = COOKING_EXPERIENCE_KEY
): Promise<{ created: number; existing: number }> {
  const db = requireDb();

  let catalog = await catalogForExperience(experienceKey);
  if (
    catalog.length === 0 &&
    experienceKey !== COOKING_EXPERIENCE_KEY
  ) {
    catalog = await catalogForExperience(COOKING_EXPERIENCE_KEY);
  }

  if (catalog.length === 0) {
    return { created: 0, existing: 0 };
  }

  const existing = await db
    .select()
    .from(eventInventoryItems)
    .where(eq(eventInventoryItems.eventId, eventId));
  const byCatalog = new Set(
    existing
      .map((r: typeof eventInventoryItems.$inferSelect) => r.catalogItemId)
      .filter((id): id is string => Boolean(id))
  );

  let created = 0;
  for (const item of catalog) {
    if (byCatalog.has(item.id)) continue;
    const primaryUrl =
      Array.isArray(item.purchaseLinks) && item.purchaseLinks[0]?.url
        ? item.purchaseLinks[0].url
        : null;
    await db.insert(eventInventoryItems).values({
      eventId,
      catalogItemId: item.id,
      vendorId: item.defaultVendorId,
      name: item.name,
      needed: true,
      ordered: false,
      received: false,
      inOffice: false,
      purchaseUrl: primaryUrl,
      notes: item.notes,
      sortOrder: item.sortOrder,
    });
    created += 1;
  }

  return { created, existing: existing.length };
}

export async function getEventInventory(eventId: string) {
  const db = requireDb();
  const rows = await db
    .select({
      item: eventInventoryItems,
      vendorName: vendors.name,
      purchaseLinks: inventoryCatalogItems.purchaseLinks,
      skuKey: inventoryCatalogItems.skuKey,
    })
    .from(eventInventoryItems)
    .leftJoin(vendors, eq(eventInventoryItems.vendorId, vendors.id))
    .leftJoin(
      inventoryCatalogItems,
      eq(eventInventoryItems.catalogItemId, inventoryCatalogItems.id)
    )
    .where(eq(eventInventoryItems.eventId, eventId))
    .orderBy(asc(eventInventoryItems.sortOrder));

  const needed = rows.filter((r) => r.item.needed).length;
  const inOffice = rows.filter((r) => r.item.needed && r.item.inOffice).length;
  const tripleCheckReady = needed > 0 && needed === inOffice;

  return {
    items: rows.map((r) => ({
      ...toApiRecord(r.item as unknown as Record<string, unknown>),
      vendor_name: r.vendorName ?? null,
      sku_key: r.skuKey ?? null,
      purchase_links: r.purchaseLinks ?? [],
    })),
    summary: {
      total: rows.length,
      needed,
      in_office: inOffice,
      triple_check_ready: tripleCheckReady,
    },
  };
}

export interface EventInventoryPatch {
  id: string;
  needed?: boolean;
  ordered?: boolean;
  received?: boolean;
  inOffice?: boolean;
  quantity?: number | null;
  purchaseUrl?: string | null;
  notes?: string | null;
  vendorId?: string | null;
}

export async function patchEventInventoryItems(
  eventId: string,
  patches: EventInventoryPatch[]
) {
  if (!Array.isArray(patches) || patches.length === 0) {
    throw new AppError("patches array is required", 400);
  }
  const db = requireDb();

  for (const p of patches) {
    if (!p.id) throw new AppError("Each patch requires id", 400);
    const [row] = await db
      .select()
      .from(eventInventoryItems)
      .where(
        and(
          eq(eventInventoryItems.id, p.id),
          eq(eventInventoryItems.eventId, eventId)
        )
      )
      .limit(1);
    if (!row) {
      throw new AppError(`Inventory item ${p.id} not found on event`, 404);
    }

    await db
      .update(eventInventoryItems)
      .set({
        ...(p.needed !== undefined ? { needed: p.needed } : {}),
        ...(p.ordered !== undefined ? { ordered: p.ordered } : {}),
        ...(p.received !== undefined ? { received: p.received } : {}),
        ...(p.inOffice !== undefined ? { inOffice: p.inOffice } : {}),
        ...(p.quantity !== undefined ? { quantity: p.quantity } : {}),
        ...(p.purchaseUrl !== undefined ? { purchaseUrl: p.purchaseUrl } : {}),
        ...(p.notes !== undefined ? { notes: p.notes } : {}),
        ...(p.vendorId !== undefined ? { vendorId: p.vendorId } : {}),
        updatedDate: new Date(),
      })
      .where(eq(eventInventoryItems.id, p.id));
  }

  return getEventInventory(eventId);
}

export interface AddEventInventoryInput {
  catalogItemId?: string | null;
  name?: string;
  purchaseUrl?: string | null;
  vendorId?: string | null;
  notes?: string | null;
  needed?: boolean;
}

export async function addEventInventoryItem(
  eventId: string,
  input: AddEventInventoryInput
) {
  const db = requireDb();
  let name = (input.name || "").trim();
  let catalogItemId = input.catalogItemId || null;
  let vendorId = input.vendorId ?? null;
  let purchaseUrl = input.purchaseUrl ?? null;
  let notes = input.notes ?? null;
  let sortOrder = 0;

  if (catalogItemId) {
    const [catalog] = await db
      .select()
      .from(inventoryCatalogItems)
      .where(eq(inventoryCatalogItems.id, catalogItemId))
      .limit(1);
    if (!catalog || !catalog.isActive) {
      throw new AppError("Catalog item not found or inactive", 404);
    }
    const [dup] = await db
      .select({ id: eventInventoryItems.id })
      .from(eventInventoryItems)
      .where(
        and(
          eq(eventInventoryItems.eventId, eventId),
          eq(eventInventoryItems.catalogItemId, catalogItemId)
        )
      )
      .limit(1);
    if (dup) {
      throw new AppError("That catalog item is already on this event", 409);
    }
    name = catalog.name;
    vendorId = vendorId ?? catalog.defaultVendorId;
    notes = notes ?? catalog.notes;
    sortOrder = catalog.sortOrder;
    if (!purchaseUrl) {
      purchaseUrl =
        Array.isArray(catalog.purchaseLinks) && catalog.purchaseLinks[0]?.url
          ? catalog.purchaseLinks[0].url
          : null;
    }
  }

  if (!name) {
    throw new AppError("name is required for custom inventory items", 400);
  }

  const existing = await db
    .select({ sortOrder: eventInventoryItems.sortOrder })
    .from(eventInventoryItems)
    .where(eq(eventInventoryItems.eventId, eventId));
  const maxSort = existing.reduce(
    (m, r) => Math.max(m, r.sortOrder ?? 0),
    0
  );
  if (!catalogItemId) {
    sortOrder = maxSort + 1;
  }

  await db.insert(eventInventoryItems).values({
    eventId,
    catalogItemId,
    vendorId,
    name,
    needed: input.needed !== false,
    ordered: false,
    received: false,
    inOffice: false,
    purchaseUrl,
    notes,
    sortOrder,
  });

  return getEventInventory(eventId);
}

export async function deleteEventInventoryItem(
  eventId: string,
  itemId: string
) {
  if (!itemId) throw new AppError("itemId is required", 400);
  const db = requireDb();
  const [row] = await db
    .select()
    .from(eventInventoryItems)
    .where(
      and(
        eq(eventInventoryItems.id, itemId),
        eq(eventInventoryItems.eventId, eventId)
      )
    )
    .limit(1);
  if (!row) {
    throw new AppError("Inventory item not found on event", 404);
  }
  await db
    .delete(eventInventoryItems)
    .where(eq(eventInventoryItems.id, itemId));
  return getEventInventory(eventId);
}

