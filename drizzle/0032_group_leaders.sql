-- CRM-13: Group Leader 2 + Support Staff on events

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "instructor_id_2" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "support_staff" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_instructor_id_2_instructors_id_fk"
    FOREIGN KEY ("instructor_id_2") REFERENCES "public"."instructors"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
