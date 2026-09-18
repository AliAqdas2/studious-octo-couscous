import {
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";

/** Editable BEO host MC script templates (Settings). */
export const beoScriptTemplates = pgTable(
  "beo_script_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull().default(""),
    createdDate: createdDate(),
    updatedDate: updatedDate(),
    createdBy: createdBy(),
  },
  (table) => [uniqueIndex("beo_script_templates_slug_uidx").on(table.slug)]
);

export const HOST_MC_SCRIPT_SLUG = "host_mc_script";
