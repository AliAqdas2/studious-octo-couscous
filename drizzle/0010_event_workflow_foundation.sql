-- Plan 01: Event workflow foundation
-- New enums, event columns, workflow template tables, task metadata

ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'In-Person Cooking';--> statement-breakpoint

ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'Planning';--> statement-breakpoint
ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'Run Of Show Scheduled';--> statement-breakpoint
ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'Pre-Event Ready';--> statement-breakpoint
ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'In Progress';--> statement-breakpoint
ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'Post-Event';--> statement-breakpoint
ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'Lost';--> statement-breakpoint
ALTER TYPE "public"."event_stage" ADD VALUE IF NOT EXISTS 'Canceled';--> statement-breakpoint

ALTER TYPE "public"."responsible_role" ADD VALUE IF NOT EXISTS 'Marketing';--> statement-breakpoint
ALTER TYPE "public"."operational_role" ADD VALUE IF NOT EXISTS 'Marketing';--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."workflow_timeline_family" AS ENUM('A', 'B');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."workflow_phase" AS ENUM(
    'upon_deposit',
    'two_point_five_weeks',
    'ros',
    'one_week_before',
    'staff_checkin_72_48h',
    'twenty_four_h',
    'during',
    'post'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."workflow_due_anchor" AS ENUM('event_date', 'deposit_date', 'immediate');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."workflow_role" AS ENUM('Sales', 'Admin', 'Ops', 'Marketing', 'Event Host');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."venue_mode" AS ENUM('go_to_them', 'house_venue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."participation_list_type" AS ENUM('sheets', 'forms');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "event_workflow_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "experience_key" varchar(100) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "timeline_family" "workflow_timeline_family" NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "event_workflow_templates_experience_version_uidx"
  ON "event_workflow_templates" ("experience_key", "version");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "event_workflow_task_defs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "phase" "workflow_phase" NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "role" "workflow_role" NOT NULL,
  "due_offset_days" integer DEFAULT 0 NOT NULL,
  "due_anchor" "workflow_due_anchor" DEFAULT 'event_date' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "resource_links" jsonb DEFAULT '[]'::jsonb,
  "conditional" jsonb DEFAULT '{}'::jsonb,
  "trace_id" varchar(20),
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "event_workflow_task_defs"
    ADD CONSTRAINT "event_workflow_task_defs_template_id_event_workflow_templates_id_fk"
    FOREIGN KEY ("template_id") REFERENCES "public"."event_workflow_templates"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "workflow_template_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "venue_mode" "venue_mode";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "start_time" varchar(50);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deposit_received_at" timestamptz;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deposit_intake_completed_at" timestamptz;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "headcount_min" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "headcount_max" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_competition" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "dish_configuration" varchar(100);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "food_additions" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "bar_details" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "media_permission" varchar(100);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "seating_curated" boolean;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "seating_style" varchar(100);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "run_of_show" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "participation_list_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "participation_list_type" "participation_list_type";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "post_event_survey_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "workflow_crm_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "beo_shell_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "day_of_poc_name" varchar(255);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "day_of_poc_email" varchar(255);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "day_of_poc_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "staff_hours_notes" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "additional_event_details" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_workflow_template_id_event_workflow_templates_id_fk"
    FOREIGN KEY ("workflow_template_id") REFERENCES "public"."event_workflow_templates"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_phase" "workflow_phase";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_task_def_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "trace_id" varchar(20);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "resource_links" jsonb DEFAULT '[]'::jsonb;
