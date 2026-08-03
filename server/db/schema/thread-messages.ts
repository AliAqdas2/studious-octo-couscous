import { boolean, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { events } from "./events.js";
import { tasks } from "./tasks.js";
import { users } from "./users.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { systemActionEnum } from "./enums.js";

export const threadMessages = pgTable("thread_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: varchar("author_name", { length: 255 }),
  body: text("body").notNull(),
  mentionedUsers: jsonb("mentioned_users"),
  attachmentUrls: jsonb("attachment_urls"),
  isSystemMessage: boolean("is_system_message").default(false),
  systemAction: systemActionEnum("system_action"),
  systemMetadata: jsonb("system_metadata"),
  parentMessageId: uuid("parent_message_id"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
