import {
  boolean,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { venues } from "./venues.js";

/** Gallery images for a house venue (plan: venue images). */
export const venueImages = pgTable("venue_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  caption: varchar("caption", { length: 255 }),
  sortOrder: integer("sort_order").notNull().default(0),
  seedKey: varchar("seed_key", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
