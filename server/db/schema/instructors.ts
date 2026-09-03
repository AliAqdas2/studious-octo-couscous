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

/** Standalone instructor bios for ops/marketing (not CRM user accounts). */
export const instructors = pgTable(
  "instructors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    bio: text("bio").notNull().default(""),
    seedKey: varchar("seed_key", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [uniqueIndex("instructors_name_uidx").on(table.name)]
);
