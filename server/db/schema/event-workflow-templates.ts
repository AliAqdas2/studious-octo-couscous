import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { workflowTimelineFamilyEnum } from "./enums.js";

export const eventWorkflowTemplates = pgTable(
  "event_workflow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experienceKey: varchar("experience_key", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    timelineFamily: workflowTimelineFamilyEnum("timeline_family").notNull(),
    /** complete | complete_ish | incomplete | stub (plan 07) */
    docQuality: varchar("doc_quality", { length: 40 }).notNull().default("complete"),
    /** e.g. Needs Zach inventory review */
    flagNote: text("flag_note"),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [
    uniqueIndex("event_workflow_templates_experience_version_uidx").on(
      table.experienceKey,
      table.version
    ),
  ]
);
