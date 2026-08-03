import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { gmailMessageSourceEnum, gmailMessageStatusEnum } from "./enums.js";

export const processedGmailMessages = pgTable("processed_gmail_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  gmailMessageId: varchar("gmail_message_id", { length: 255 }).notNull().unique(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  source: gmailMessageSourceEnum("source"),
  status: gmailMessageStatusEnum("status"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
