import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const gmailPollState = pgTable("gmail_poll_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 50 }).notNull().unique().default("default"),
  lastHistoryId: varchar("last_history_id", { length: 255 }),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastWebhookReceivedAt: timestamp("last_webhook_received_at", { withTimezone: true }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
