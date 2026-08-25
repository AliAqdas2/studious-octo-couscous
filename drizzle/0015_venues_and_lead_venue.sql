-- Plan 08: admin-managed venues + lead venue sync with events

CREATE TABLE IF NOT EXISTS "venues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(255)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "venues_name_uidx" ON "venues" ("name");--> statement-breakpoint

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "venue" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "venue_mode" "venue_mode";
