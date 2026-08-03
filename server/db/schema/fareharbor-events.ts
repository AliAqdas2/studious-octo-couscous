import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const fareharborEvents = pgTable("fareharbor_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("eventType", { length: 255 }).notNull(),
  bookingUuid: varchar("bookingUuid", { length: 255 }),
  bookingStatus: varchar("bookingStatus", { length: 255 }),
  startAt: timestamp("startAt", { withTimezone: true }),
  endAt: timestamp("endAt", { withTimezone: true }),
  itemName: varchar("itemName", { length: 255 }),
  crew: jsonb("crew"),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 255 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  note: text("note"),
  rawPayload: jsonb("rawPayload"),
  receivedAt: timestamp("receivedAt", { withTimezone: true }).notNull(),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
