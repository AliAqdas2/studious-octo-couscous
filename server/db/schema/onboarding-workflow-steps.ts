import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { onboardingWorkflowTemplates } from "./onboarding-workflow-templates.js";

/** Clickable payload attached to a workflow step. */
export interface OnboardingStepResource {
  type: "link" | "video" | "email" | "contact" | "document" | "checklist" | "note";
  label: string;
  url?: string;
  detail?: string;
  slug?: string;
  action?: "email" | "link";
  contractorOnly?: boolean;
}

export const onboardingWorkflowSteps = pgTable("onboarding_workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => onboardingWorkflowTemplates.id, { onDelete: "cascade" }),
  phase: varchar("phase", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  title: varchar("title", { length: 255 }).notNull(),
  instructions: text("instructions"),
  stepType: varchar("step_type", { length: 100 }).notNull().default("action"),
  ownerRole: varchar("owner_role", { length: 100 }),
  isGate: boolean("is_gate").notNull().default(false),
  slaHours: integer("sla_hours"),
  resources: jsonb("resources").$type<OnboardingStepResource[]>().default([]),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
