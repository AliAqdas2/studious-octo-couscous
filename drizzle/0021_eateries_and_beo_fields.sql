-- Food tour eateries catalog, per-event stops, venue guidelines, BEO instructor link

CREATE TABLE IF NOT EXISTS "eateries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "address" text,
  "time_label" varchar(50) DEFAULT 'Reservation Time' NOT NULL,
  "order_mode" varchar(50) DEFAULT 'PRE-ORDERED' NOT NULL,
  "order_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "drink_option" text,
  "order_key_dishes" text,
  "notes" text,
  "seed_key" varchar(100),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "eateries_name_uidx" ON "eateries" ("name");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "event_eatery_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "eatery_id" uuid,
  "name" varchar(255) NOT NULL,
  "address" text,
  "stop_time" varchar(50),
  "guest_count" integer,
  "time_label" varchar(50) DEFAULT 'Reservation Time' NOT NULL,
  "order_mode" varchar(50) DEFAULT 'PRE-ORDERED' NOT NULL,
  "order_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "drink_option" text,
  "order_key_dishes" text,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_date" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

ALTER TABLE "event_eatery_stops"
  ADD CONSTRAINT "event_eatery_stops_event_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."events"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "event_eatery_stops"
  ADD CONSTRAINT "event_eatery_stops_eatery_id_fk"
  FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_eatery_stops_event_idx" ON "event_eatery_stops" ("event_id");--> statement-breakpoint

ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "guidelines" text;--> statement-breakpoint

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "instructor_id" uuid;--> statement-breakpoint

ALTER TABLE "events"
  ADD CONSTRAINT "events_instructor_id_fk"
  FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id")
  ON DELETE set null ON UPDATE no action;
