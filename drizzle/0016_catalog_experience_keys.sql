-- Multi-experience catalog: experience_keys jsonb array (replaces experience_key)
-- Idempotent: safe if experience_key was already dropped.

ALTER TABLE "inventory_catalog_items"
  ADD COLUMN IF NOT EXISTS "experience_keys" jsonb;--> statement-breakpoint

-- Backfill from legacy experience_key only when that column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_catalog_items'
      AND column_name = 'experience_key'
  ) THEN
    EXECUTE $sql$
      UPDATE "inventory_catalog_items"
      SET "experience_keys" = jsonb_build_array(
        COALESCE(NULLIF(trim("experience_key"), ''), 'In-Person Cooking')
      )
      WHERE "experience_keys" IS NULL
    $sql$;
  ELSE
    UPDATE "inventory_catalog_items"
    SET "experience_keys" = '["In-Person Cooking"]'::jsonb
    WHERE "experience_keys" IS NULL;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "inventory_catalog_items"
  ALTER COLUMN "experience_keys" SET DEFAULT '["In-Person Cooking"]'::jsonb;--> statement-breakpoint

UPDATE "inventory_catalog_items"
SET "experience_keys" = '["In-Person Cooking"]'::jsonb
WHERE "experience_keys" IS NULL;--> statement-breakpoint

ALTER TABLE "inventory_catalog_items"
  ALTER COLUMN "experience_keys" SET NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "inventory_catalog_items_sku_experience_uidx";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_catalog_items_sku_uidx"
  ON "inventory_catalog_items" ("sku_key");--> statement-breakpoint

ALTER TABLE "inventory_catalog_items" DROP COLUMN IF EXISTS "experience_key";
