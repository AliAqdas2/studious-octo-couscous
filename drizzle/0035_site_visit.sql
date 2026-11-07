-- CRM-18: Client Venue site visit fields (kept when switching to Our Venue)

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "site_visit_date" timestamptz;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "site_visit_notes" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "site_visit_parking" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "site_visit_contacts" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "site_visit_photos" jsonb;
