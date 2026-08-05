import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const gmailPollState = pgTable("gmail_poll_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 50 }).notNull().unique().default("default"),
  lastHistoryId: varchar("last_history_id", { length: 255 }),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastWebhookReceivedAt: timestamp("last_webhook_received_at", { withTimezone: true }),
  watchExpiration: timestamp("watch_expiration", { withTimezone: true }),
  watchRegisteredAt: timestamp("watch_registered_at", { withTimezone: true }),
  lastTokenRefreshAt: timestamp("last_token_refresh_at", { withTimezone: true }),
  lastConnectionError: text("last_connection_error"),
  disconnectAlertSentAt: timestamp("disconnect_alert_sent_at", { withTimezone: true }),
  deadLetterAlertSentAt: timestamp("dead_letter_alert_sent_at", { withTimezone: true }),
  lastDeadLetterError: text("last_dead_letter_error"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
