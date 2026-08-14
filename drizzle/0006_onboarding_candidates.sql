-- Onboarding Phase 1: candidates + workflow templates/steps
ALTER TYPE "public"."activity_entity_type" ADD VALUE IF NOT EXISTS 'Candidate';
--> statement-breakpoint
CREATE TYPE "public"."candidate_job_role" AS ENUM('Event Support Associate', 'Event Team Lead', 'Culinary Instructor', 'Food Tour Guide');
--> statement-breakpoint
CREATE TYPE "public"."candidate_hire_type" AS ENUM('Practicum', 'Internship', 'Part-time', 'Contractor');
--> statement-breakpoint
CREATE TYPE "public"."candidate_hire_source" AS ENUM('Indeed', 'Employee referral', 'University / career fair', 'University email blast', 'Company website', 'Other');
--> statement-breakpoint
CREATE TYPE "public"."onboarding_template_status" AS ENUM('ready', 'coming_soon');
--> statement-breakpoint
CREATE TYPE "public"."candidate_step_status" AS ENUM('pending', 'in_progress', 'done', 'blocked', 'skipped');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"job_role" "candidate_job_role" NOT NULL,
	"hire_type" "candidate_hire_type" NOT NULL,
	"source" "candidate_hire_source" NOT NULL,
	"source_detail" varchar(255),
	"stage" varchar(255) DEFAULT 'Application Received' NOT NULL,
	"resume_url" text,
	"decline_reason" text,
	"retain_for_future" boolean DEFAULT true,
	"notes" text,
	"assigned_to" uuid,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"job_role" "candidate_job_role" NOT NULL,
	"hire_type" "candidate_hire_type",
	"version" integer DEFAULT 1 NOT NULL,
	"status" "onboarding_template_status" DEFAULT 'coming_soon' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"phase" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" varchar(255) NOT NULL,
	"instructions" text,
	"step_type" varchar(100) DEFAULT 'action' NOT NULL,
	"owner_role" varchar(100),
	"is_gate" boolean DEFAULT false NOT NULL,
	"sla_hours" integer,
	"resources" jsonb DEFAULT '[]'::jsonb,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"workflow_step_id" uuid,
	"phase" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" varchar(255) NOT NULL,
	"instructions" text,
	"step_type" varchar(100) DEFAULT 'action' NOT NULL,
	"owner_role" varchar(100),
	"is_gate" boolean DEFAULT false NOT NULL,
	"sla_hours" integer,
	"resources" jsonb DEFAULT '[]'::jsonb,
	"status" "candidate_step_status" DEFAULT 'pending' NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidates" ADD CONSTRAINT "candidates_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidates" ADD CONSTRAINT "candidates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_workflow_templates" ADD CONSTRAINT "onboarding_workflow_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_workflow_steps" ADD CONSTRAINT "onboarding_workflow_steps_template_id_onboarding_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_workflow_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_workflow_steps" ADD CONSTRAINT "onboarding_workflow_steps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_steps" ADD CONSTRAINT "candidate_steps_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_steps" ADD CONSTRAINT "candidate_steps_workflow_step_id_onboarding_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."onboarding_workflow_steps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_steps" ADD CONSTRAINT "candidate_steps_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_steps" ADD CONSTRAINT "candidate_steps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
