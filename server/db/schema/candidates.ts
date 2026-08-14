import {
  boolean,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import {
  candidateHireSourceEnum,
  candidateHireTypeEnum,
  candidateJobRoleEnum,
} from "./enums.js";

export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  jobRole: candidateJobRoleEnum("job_role").notNull(),
  hireType: candidateHireTypeEnum("hire_type").notNull(),
  source: candidateHireSourceEnum("source").notNull(),
  sourceDetail: varchar("source_detail", { length: 255 }),
  stage: varchar("stage", { length: 255 }).notNull().default("Application Received"),
  resumeUrl: text("resume_url"),
  declineReason: text("decline_reason"),
  retainForFuture: boolean("retain_for_future").default(true),
  notes: text("notes"),
  assignedTo: uuid("assigned_to").references(() => users.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
