-- CRM-11: Attendee List last-updated metadata on events

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_list_updated_at" timestamptz;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_list_updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_list_updated_by_name" varchar(255);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_attendee_list_updated_by_users_id_fk"
    FOREIGN KEY ("attendee_list_updated_by") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
