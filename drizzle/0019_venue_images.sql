-- Plan 08+: venue_images (many images per house venue)

CREATE TABLE IF NOT EXISTS "venue_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL,
  "image_url" varchar(500) NOT NULL,
  "caption" varchar(255),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "seed_key" varchar(100),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "venue_images_seed_key_uidx"
  ON "venue_images" ("seed_key")
  WHERE "seed_key" IS NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "venue_images"
    ADD CONSTRAINT "venue_images_venue_id_venues_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
