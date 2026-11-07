import { integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { events } from "./events.js";

/** Per-event guest list (Name / Allergies / Phone Number / Email) for BEO and day-of. */
export const eventAttendees = pgTable("event_attendees", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  allergies: text("allergies"),
  phone: varchar("phone", { length: 100 }),
  /** CRM-15: separate from phone — never import-mapped from phone headers. */
  email: varchar("email", { length: 255 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
