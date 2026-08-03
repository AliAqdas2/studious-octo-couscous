import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { activityEntityTypeEnum } from "./enums.js";

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: activityEntityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: jsonb("details"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: varchar("user_name", { length: 255 }),
  timestamp: timestamp("timestamp", { withTimezone: true }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
