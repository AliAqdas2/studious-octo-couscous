import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdBy, createdDate, updatedDate } from "./metadata.js";
import { clientBusinessTypeEnum } from "./enums.js";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  additionalContacts: jsonb("additional_contacts"),
  clientType: clientBusinessTypeEnum("client_type"),
  totalEvents: integer("total_events").default(0),
  lifetimeRevenue: real("lifetime_revenue").default(0),
  averageEventValue: real("average_event_value").default(0),
  firstEventDate: timestamp("first_event_date", { withTimezone: true }),
  lastEventDate: timestamp("last_event_date", { withTimezone: true }),
  isVip: boolean("is_vip").default(false),
  isReturning: boolean("is_returning").default(false),
  newsletterSubscribed: boolean("newsletter_subscribed").default(false),
  linkedinConnected: boolean("linkedin_connected").default(false),
  tshirtSent: boolean("tshirt_sent").default(false),
  lostIntelligence: jsonb("lost_intelligence"),
  notes: text("notes"),
  createdDate: createdDate(),
  updatedDate: updatedDate(),
  createdBy: createdBy(),
});
