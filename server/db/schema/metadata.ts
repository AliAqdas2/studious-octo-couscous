import { timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const createdDate = () =>
  timestamp("created_date", { withTimezone: true }).defaultNow().notNull();

export const updatedDate = () =>
  timestamp("updated_date", { withTimezone: true }).defaultNow().notNull();

export const createdBy = () =>
  uuid("created_by").references(() => users.id, { onDelete: "set null" });
