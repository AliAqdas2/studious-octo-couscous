import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { gmailMessageSourceEnum } from "./enums.js";
import { createdDate, updatedDate } from "./metadata.js";

/** Preserved email snapshots when intake exhausts retries — email is never lost. */
export const gmailIntakeDeadLetters = pgTable("gmail_intake_dead_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  gmailMessageId: varchar("gmail_message_id", { length: 255 }).notNull().unique(),
  from: varchar("from", { length: 500 }),
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  threadId: varchar("thread_id", { length: 255 }),
  snippet: text("snippet"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  source: gmailMessageSourceEnum("source"),
  failedAt: timestamp("failed_at", { withTimezone: true }).notNull(),
  alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
});
