import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 100 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    website: varchar("website", { length: 500 }),
    notes: text("notes"),
    usedFor: varchar("used_for", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [uniqueIndex("vendors_name_uidx").on(table.name)]
);

export interface InventoryPurchaseLink {
  label: string;
  url: string;
}

export const inventoryCatalogItems = pgTable(
  "inventory_catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skuKey: varchar("sku_key", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Experiences this SKU applies to (e.g. Cooking + Paint). */
    experienceKeys: jsonb("experience_keys")
      .$type<string[]>()
      .notNull()
      .default(["In-Person Cooking"]),
    defaultVendorId: uuid("default_vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),
    purchaseLinks: jsonb("purchase_links").$type<InventoryPurchaseLink[]>().default([]),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [uniqueIndex("inventory_catalog_items_sku_uidx").on(table.skuKey)]
);
