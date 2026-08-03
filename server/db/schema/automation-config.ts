import { boolean, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

export const automationConfig = pgTable("automation_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 50 }).notNull().unique().default("default"),
  enabled: boolean("enabled").default(true),
  businessHoursGateEnabled: boolean("business_hours_gate_enabled").default(true),
  useRepCallerIdEnabled: boolean("use_rep_caller_id_enabled").default(false),
  repPhone: varchar("rep_phone", { length: 50 }),
  repEmail: varchar("rep_email", { length: 255 }),
  calendarLink: text("calendar_link"),
  companyTriggerPrefix: varchar("company_trigger_prefix", { length: 50 }).default("ALITEST"),
  maxAttempts: integer("max_attempts").default(3),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
