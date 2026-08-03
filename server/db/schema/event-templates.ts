import { boolean, jsonb, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { eventTypeEnum } from "./enums.js";

export const eventTemplates = pgTable("event_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  eventType: eventTypeEnum("event_type").notNull(),
  description: text("description"),
  preEventTasks: jsonb("pre_event_tasks"),
  eventDayTasks: jsonb("event_day_tasks"),
  postEventTasks: jsonb("post_event_tasks"),
  isActive: boolean("is_active").default(true),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
