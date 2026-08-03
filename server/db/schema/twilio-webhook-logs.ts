import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const twilioWebhookLogs = pgTable("twilio_webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type", { length: 255 }).notNull(),
  status: varchar("status", { length: 255 }),
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  businessProfileSid: varchar("business_profile_sid", { length: 255 }),
  rawPayload: jsonb("raw_payload"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
