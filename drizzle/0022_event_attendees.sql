-- Per-event attendee list for CRM + BEO

CREATE TABLE IF NOT EXISTS "event_attendees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "allergies" text,
  "phone" varchar(100),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_date" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

ALTER TABLE "event_attendees"
  ADD CONSTRAINT "event_attendees_event_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."events"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_attendees_event_idx" ON "event_attendees" ("event_id");
