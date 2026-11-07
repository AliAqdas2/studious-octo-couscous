import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { events } from "./events.js";
import { users } from "./users.js";

export const clientCommDueAnchorEnum = pgEnum("client_comm_due_anchor", [
  "before_event",
  "after_event",
  "none",
]);

export const clientCommEventTypeScopeEnum = pgEnum(
  "client_comm_event_type_scope",
  ["all", "food_tour", "cooking"]
);

export const clientCommStageStatusEnum = pgEnum("client_comm_stage_status", [
  "pending",
  "done",
]);

/** Catalog of client outreach stages + email scripts (CRM-22). */
export const clientCommunicationStageDefs = pgTable(
  "client_communication_stage_defs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 120 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    subject: varchar("subject", { length: 500 }),
    body: text("body").notNull().default(""),
    defaultOwnerRole: varchar("default_owner_role", { length: 100 }).default(
      "Sales"
    ),
    dueOffsetDays: integer("due_offset_days"),
    dueAnchor: clientCommDueAnchorEnum("due_anchor").notNull().default("none"),
    eventTypeScope: clientCommEventTypeScopeEnum("event_type_scope")
      .notNull()
      .default("all"),
    /** Cooking Class UI shows only stages with this flag (client's short list). */
    showInSimpleTrack: boolean("show_in_simple_track").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [
    uniqueIndex("client_communication_stage_defs_slug_uidx").on(table.slug),
  ]
);

/** Per-event client communication stage instances (CRM-22). */
export const eventClientCommunicationStages = pgTable(
  "event_client_communication_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    defId: uuid("def_id")
      .notNull()
      .references(() => clientCommunicationStageDefs.id, {
        onDelete: "restrict",
      }),
    title: varchar("title", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    templateSubject: varchar("template_subject", { length: 500 }),
    templateBody: text("template_body").notNull().default(""),
    assignedUser: uuid("assigned_user").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: clientCommStageStatusEnum("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [
    uniqueIndex("event_client_comm_stages_event_def_uidx").on(
      table.eventId,
      table.defId
    ),
  ]
);
