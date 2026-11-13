-- Lead Source: Google Ads enum value + free-text detail for Other

ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'Google Ads';

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source_other" varchar(255);
