import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { spamCategoryEnum } from "./enums.js";

export const spamEmails = pgTable("spam_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  from: varchar("from", { length: 500 }).notNull(),
  senderEmail: varchar("sender_email", { length: 255 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body"),
  pageUrl: text("page_url"),
  gmailMessageId: varchar("gmail_message_id", { length: 255 }),
  gmailThreadId: varchar("gmail_thread_id", { length: 255 }),
  spamCategory: spamCategoryEnum("spam_category"),
  spamReason: text("spam_reason"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
