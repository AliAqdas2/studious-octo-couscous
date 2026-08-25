import {
  boolean,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

/** Admin-managed house venues (plan 08). "Other" stays a UI escape hatch, not a row. */
export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [uniqueIndex("venues_name_uidx").on(table.name)]
);
