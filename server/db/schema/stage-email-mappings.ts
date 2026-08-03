import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { emailCategoryEnum, stageEmailChannelEnum } from "./enums.js";

export const stageEmailMappings = pgTable("stage_email_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  stage: varchar("stage", { length: 255 }).notNull(),
  channel: stageEmailChannelEnum("channel").default("Both"),
  emailCategory: emailCategoryEnum("email_category").notNull(),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  lastSentTemplate: varchar("last_sent_template", { length: 255 }),
  lastSentDate: timestamp("last_sent_date", { withTimezone: true }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
