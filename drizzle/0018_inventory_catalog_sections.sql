-- Plan: inventory catalog sections, hierarchy, quantity hints

ALTER TABLE "inventory_catalog_items"
  ADD COLUMN IF NOT EXISTS "section" varchar(100);--> statement-breakpoint

ALTER TABLE "inventory_catalog_items"
  ADD COLUMN IF NOT EXISTS "parent_sku_key" varchar(100);--> statement-breakpoint

ALTER TABLE "inventory_catalog_items"
  ADD COLUMN IF NOT EXISTS "quantity_hint" text;
