import {
  boolean,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { events } from "./events.js";
import { users } from "./users.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import {
  responsibleRoleEnum,
  taskCategoryEnum,
  taskStatusEnum,
  workflowPhaseEnum,
} from "./enums.js";
import type { WorkflowResourceLink } from "./event-workflow-task-defs.js";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: taskCategoryEnum("category").notNull(),
  responsibleRole: responsibleRoleEnum("responsible_role").notNull(),
  assignedUser: uuid("assigned_user").references(() => users.id, { onDelete: "set null" }),
  status: taskStatusEnum("status").default("Not Acknowledged"),
  acknowledgedTimestamp: timestamp("acknowledged_timestamp", { withTimezone: true }),
  completionTimestamp: timestamp("completion_timestamp", { withTimezone: true }),
  overrideFlag: boolean("override_flag").default(false),
  overrideTimestamp: timestamp("override_timestamp", { withTimezone: true }),
  previousAssignee: uuid("previous_assignee").references(() => users.id, {
    onDelete: "set null",
  }),
  overriddenBy: uuid("overridden_by").references(() => users.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  order: real("order"),
  progressNotes: text("progress_notes"),
  workflowPhase: workflowPhaseEnum("workflow_phase"),
  workflowTaskDefId: uuid("workflow_task_def_id"),
  traceId: varchar("trace_id", { length: 20 }),
  resourceLinks: jsonb("resource_links").$type<WorkflowResourceLink[]>().default([]),
  /** Staff status, supply pickup method, ice, etc. (plan 03) */
  workflowMeta: jsonb("workflow_meta").$type<Record<string, unknown>>().default({}),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
