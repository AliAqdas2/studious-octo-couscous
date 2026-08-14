import {
  boolean,
  integer,
  pgTable,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import {
  candidateHireTypeEnum,
  candidateJobRoleEnum,
  onboardingTemplateStatusEnum,
} from "./enums.js";

export const onboardingWorkflowTemplates = pgTable(
  "onboarding_workflow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    jobRole: candidateJobRoleEnum("job_role").notNull(),
    hireType: candidateHireTypeEnum("hire_type"),
    version: integer("version").notNull().default(1),
    status: onboardingTemplateStatusEnum("status").notNull().default("coming_soon"),
    isActive: boolean("is_active").notNull().default(true),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  }
);
