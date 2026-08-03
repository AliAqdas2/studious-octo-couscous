import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";
import { threadMessages } from "./thread-messages.js";
import { users } from "./users.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const mentionReads = pgTable("mention_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
