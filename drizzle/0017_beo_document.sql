-- In-app Admin BEO document (HTML) after Run of Show
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_document_html" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_document_updated_at" timestamp with time zone;--> statement-breakpoint
