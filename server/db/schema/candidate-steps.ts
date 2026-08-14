import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { candidates } from "./candidates.js";
import { onboardingWorkflowSteps } from "./onboarding-workflow-steps.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { candidateStepStatusEnum } from "./enums.js";
import type { OnboardingStepResource } from "./onboarding-workflow-steps.js";

export const candidateSteps = pgTable("candidate_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  workflowStepId: uuid("workflow_step_id").references(
    () => onboardingWorkflowSteps.id,
    { onDelete: "set null" }
  ),
  phase: varchar("phase", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  title: varchar("title", { length: 255 }).notNull(),
  instructions: text("instructions"),
  stepType: varchar("step_type", { length: 100 }).notNull().default("action"),
  ownerRole: varchar("owner_role", { length: 100 }),
  isGate: boolean("is_gate").notNull().default(false),
  slaHours: integer("sla_hours"),
  resources: jsonb("resources").$type<OnboardingStepResource[]>().default([]),
  status: candidateStepStatusEnum("status").notNull().default("pending"),
  completedBy: uuid("completed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
