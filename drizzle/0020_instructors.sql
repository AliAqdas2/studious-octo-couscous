-- Standalone instructor bio catalog (Settings + seed from markdown)

CREATE TABLE IF NOT EXISTS "instructors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "bio" text DEFAULT '' NOT NULL,
  "seed_key" varchar(100),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "instructors_name_uidx" ON "instructors" ("name");
