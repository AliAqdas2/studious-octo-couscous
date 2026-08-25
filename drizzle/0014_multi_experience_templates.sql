-- Plan 07: multi-experience templates — enums + template metadata

ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Pottery';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Terrarium';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'Flavors of DC';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Chocolate Making';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Chocolate & Wine';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Cheeseboard';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Gingerbread';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Lend a Hand';--> statement-breakpoint

ALTER TYPE "public"."workflow_timeline_family" ADD VALUE IF NOT EXISTS 'C';--> statement-breakpoint

ALTER TYPE "public"."workflow_phase" ADD VALUE IF NOT EXISTS 'three_weeks';--> statement-breakpoint
ALTER TYPE "public"."workflow_phase" ADD VALUE IF NOT EXISTS 'two_weeks';--> statement-breakpoint

ALTER TABLE "event_workflow_templates"
  ADD COLUMN IF NOT EXISTS "doc_quality" varchar(40) DEFAULT 'complete' NOT NULL;--> statement-breakpoint

ALTER TABLE "event_workflow_templates"
  ADD COLUMN IF NOT EXISTS "flag_note" text;
