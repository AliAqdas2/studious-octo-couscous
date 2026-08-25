import {
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import {
  workflowDueAnchorEnum,
  workflowPhaseEnum,
  workflowRoleEnum,
} from "./enums.js";
import { eventWorkflowTemplates } from "./event-workflow-templates.js";

/** Resource link attached to a workflow task definition. */
export interface WorkflowResourceLink {
  label: string;
  url: string;
  optional?: boolean;
}

export const eventWorkflowTaskDefs = pgTable("event_workflow_task_defs", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => eventWorkflowTemplates.id, { onDelete: "cascade" }),
  phase: workflowPhaseEnum("phase").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  role: workflowRoleEnum("role").notNull(),
  dueOffsetDays: integer("due_offset_days").notNull().default(0),
  dueAnchor: workflowDueAnchorEnum("due_anchor").notNull().default("event_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  resourceLinks: jsonb("resource_links").$type<WorkflowResourceLink[]>().default([]),
  conditional: jsonb("conditional").$type<Record<string, unknown>>().default({}),
  /** COOKING-TRACEABILITY id, e.g. C038 */
  traceId: varchar("trace_id", { length: 20 }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
