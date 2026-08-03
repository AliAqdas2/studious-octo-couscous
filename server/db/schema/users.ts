import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  phone: varchar("phone", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  passwordHash: varchar("password_hash", { length: 255 }),
  inviteToken: varchar("invite_token", { length: 255 }),
  inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdDate: timestamp("created_date", { withTimezone: true }).defaultNow().notNull(),
  updatedDate: timestamp("updated_date", { withTimezone: true }).defaultNow().notNull(),
});
