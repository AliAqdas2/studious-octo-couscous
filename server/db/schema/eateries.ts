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

/**
 * A single order line for a food-tour stop.
 * `perGuests` is how many guests one order serves, so quantity is
 * ceil(guestCount / perGuests). Null means an instruction with no quantity.
 */
export interface EateryOrderLine {
  label: string;
  perGuests: number | null;
  note?: string | null;
}

export type EateryTimeLabel = "Reservation Time" | "Arrival Time";
export type EateryOrderMode = "PRE-ORDERED" | "ORDERING AT";

/** Restaurant catalog used to build food-tour BEO order sections. */
export const eateries = pgTable(
  "eateries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    timeLabel: varchar("time_label", { length: 50 })
      .$type<EateryTimeLabel>()
      .notNull()
      .default("Reservation Time"),
    orderMode: varchar("order_mode", { length: 50 })
      .$type<EateryOrderMode>()
      .notNull()
      .default("PRE-ORDERED"),
    orderLines: jsonb("order_lines")
      .$type<EateryOrderLine[]>()
      .notNull()
      .default([]),
    drinkOption: text("drink_option"),
    orderKeyDishes: text("order_key_dishes"),
    notes: text("notes"),
    seedKey: varchar("seed_key", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [uniqueIndex("eateries_name_uidx").on(table.name)]
);
