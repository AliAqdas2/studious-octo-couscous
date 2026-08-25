-- Plan 04: vendors, inventory catalog, per-event inventory checklist

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(100) NOT NULL,
  "phone" varchar(100),
  "email" varchar(255),
  "address" text,
  "website" varchar(500),
  "notes" text,
  "used_for" varchar(100),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "vendors_name_uidx" ON "vendors" ("name");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "inventory_catalog_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sku_key" varchar(100) NOT NULL,
  "name" varchar(255) NOT NULL,
  "experience_key" varchar(100) DEFAULT 'In-Person Cooking' NOT NULL,
  "default_vendor_id" uuid,
  "purchase_links" jsonb DEFAULT '[]'::jsonb,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_catalog_items_sku_experience_uidx"
  ON "inventory_catalog_items" ("sku_key", "experience_key");--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "inventory_catalog_items"
    ADD CONSTRAINT "inventory_catalog_items_default_vendor_id_vendors_id_fk"
    FOREIGN KEY ("default_vendor_id") REFERENCES "public"."vendors"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "event_inventory_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "catalog_item_id" uuid,
  "vendor_id" uuid,
  "name" varchar(255) NOT NULL,
  "needed" boolean DEFAULT true NOT NULL,
  "ordered" boolean DEFAULT false NOT NULL,
  "received" boolean DEFAULT false NOT NULL,
  "in_office" boolean DEFAULT false NOT NULL,
  "quantity" integer,
  "purchase_url" text,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "event_inventory_items_event_catalog_uidx"
  ON "event_inventory_items" ("event_id", "catalog_item_id");--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "event_inventory_items"
    ADD CONSTRAINT "event_inventory_items_event_id_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "public"."events"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "event_inventory_items"
    ADD CONSTRAINT "event_inventory_items_catalog_item_id_inventory_catalog_items_id_fk"
    FOREIGN KEY ("catalog_item_id") REFERENCES "public"."inventory_catalog_items"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "event_inventory_items"
    ADD CONSTRAINT "event_inventory_items_vendor_id_vendors_id_fk"
    FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
