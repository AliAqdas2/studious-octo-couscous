-- Pick-Up / Delivery logistics on food-tour eatery stops (Flavors of DC BEO Orders)

ALTER TABLE "event_eatery_stops" ADD COLUMN IF NOT EXISTS "fulfillment_type" varchar(50);--> statement-breakpoint
ALTER TABLE "event_eatery_stops" ADD COLUMN IF NOT EXISTS "fulfillment_time" varchar(50);--> statement-breakpoint
ALTER TABLE "event_eatery_stops" ADD COLUMN IF NOT EXISTS "fulfillment_contact" varchar(255);--> statement-breakpoint
ALTER TABLE "event_eatery_stops" ADD COLUMN IF NOT EXISTS "fulfillment_address" text;
