import { boolean, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import {
  customerTypeEnum,
  emailCategoryEnum,
  emailTemplateChannelEnum,
  sendModeEnum,
} from "./enums.js";

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  pipelineStage: varchar("pipeline_stage", { length: 255 }),
  channel: emailTemplateChannelEnum("channel").default("Both"),
  customerType: customerTypeEnum("customer_type").default("Doesn't matter"),
  category: emailCategoryEnum("category"),
  isActive: boolean("is_active").default(true),
  sendAutomatically: boolean("send_automatically").default(false),
  sendMode: sendModeEnum("send_mode").default("send"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
