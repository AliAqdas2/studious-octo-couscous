-- Editable BEO host MC script templates (Settings + seed from ScriptforBEO)

CREATE TABLE IF NOT EXISTS "beo_script_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "created_date" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_date" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "beo_script_templates_slug_uidx" ON "beo_script_templates" ("slug");
