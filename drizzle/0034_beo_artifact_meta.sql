-- CRM-16: hosted Admin BEO artifact link metadata (label + saved audit)

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_url_label" varchar(255);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_url_saved_at" timestamptz;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_url_saved_by" uuid;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_url_saved_by_name" varchar(255);

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_beo_url_saved_by_users_id_fk"
    FOREIGN KEY ("beo_url_saved_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
