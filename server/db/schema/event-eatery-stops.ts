import {
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { eateries } from "./eateries.js";
import type {
  EateryOrderLine,
  EateryOrderMode,
  EateryTimeLabel,
} from "./eateries.js";
import { events } from "./events.js";

export type EateryFulfillmentType = "Pick-Up" | "Delivery";

/** A selected food-tour stop for one event; order lines are an editable copy. */
export const eventEateryStops = pgTable("event_eatery_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  eateryId: uuid("eatery_id").references(() => eateries.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  stopTime: varchar("stop_time", { length: 50 }),
  guestCount: integer("guest_count"),
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
  /** Logistics: Pick-Up or Delivery (separate from PRE-ORDERED / ORDERING AT). */
  fulfillmentType: varchar("fulfillment_type", { length: 50 }).$type<
    EateryFulfillmentType
  >(),
  fulfillmentTime: varchar("fulfillment_time", { length: 50 }),
  fulfillmentContact: varchar("fulfillment_contact", { length: 255 }),
  fulfillmentAddress: text("fulfillment_address"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
