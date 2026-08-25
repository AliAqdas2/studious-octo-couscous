import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { events } from "./events.js";
import { inventoryCatalogItems, vendors } from "./vendors.js";

/** Per-event inventory checklist row (plan 04). */
export const eventInventoryItems = pgTable(
  "event_inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    catalogItemId: uuid("catalog_item_id").references(() => inventoryCatalogItems.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    needed: boolean("needed").notNull().default(true),
    ordered: boolean("ordered").notNull().default(false),
    received: boolean("received").notNull().default(false),
    inOffice: boolean("in_office").notNull().default(false),
    quantity: integer("quantity"),
    purchaseUrl: text("purchase_url"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [
    uniqueIndex("event_inventory_items_event_catalog_uidx").on(
      table.eventId,
      table.catalogItemId
    ),
  ]
);
