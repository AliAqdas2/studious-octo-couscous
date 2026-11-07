-- CRM-09: optional full address for custom / client venues

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "venue_address" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "venue_address" text;
