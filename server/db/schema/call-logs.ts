import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { leads } from "./leads.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { callLogStatusEnum } from "./enums.js";

export const callLogs = pgTable("call_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  leadName: varchar("lead_name", { length: 255 }),
  leadCompany: varchar("lead_company", { length: 255 }),
  leadPhone: varchar("lead_phone", { length: 50 }),
  leadBrief: text("lead_brief"),
  repPhone: varchar("rep_phone", { length: 50 }),
  repEmail: varchar("rep_email", { length: 255 }),
  attemptNumber: integer("attempt_number").default(1),
  status: callLogStatusEnum("status").default("Initiated"),
  twilioCallSid: varchar("twilio_call_sid", { length: 255 }),
  twilioExecutionSid: varchar("twilio_execution_sid", { length: 255 }),
  recordingUrl: text("recording_url"),
  transcript: text("transcript"),
  summary: text("summary"),
  extractedBudget: varchar("extracted_budget", { length: 255 }),
  extractedHeadcount: varchar("extracted_headcount", { length: 255 }),
  extractedTiming: varchar("extracted_timing", { length: 255 }),
  extractedNextStage: varchar("extracted_next_stage", { length: 255 }),
  extractedNotes: text("extracted_notes"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  scheduledRetryAt: timestamp("scheduled_retry_at", { withTimezone: true }),
  retryProcessed: boolean("retry_processed").default(false),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
