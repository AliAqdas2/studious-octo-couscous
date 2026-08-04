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

/** Pending Gmail intake re-attempts (message not terminal until success or dead-letter). */
export const gmailIntakeRetries = pgTable("gmail_intake_retries", {
  id: uuid("id").primaryKey().defaultRandom(),
  gmailMessageId: varchar("gmail_message_id", { length: 255 }).notNull().unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }).notNull(),
  source: gmailMessageSourceEnum("source"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
});
