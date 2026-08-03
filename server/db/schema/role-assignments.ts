import { boolean, jsonb, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { operationalRoleEnum } from "./enums.js";

export const roleAssignments = pgTable("role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: varchar("user_email", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),
  role: operationalRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  coverageRules: jsonb("coverage_rules"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
