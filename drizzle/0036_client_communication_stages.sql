-- CRM-22: Client Communication stage catalog + per-event instances

DO $$ BEGIN
  CREATE TYPE "client_comm_due_anchor" AS ENUM ('before_event', 'after_event', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "client_comm_event_type_scope" AS ENUM ('all', 'food_tour', 'cooking');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "client_comm_stage_status" AS ENUM ('pending', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "client_communication_stage_defs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(120) NOT NULL,
  "title" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "subject" varchar(500),
  "body" text DEFAULT '' NOT NULL,
  "default_owner_role" varchar(100) DEFAULT 'Sales',
  "due_offset_days" integer,
  "due_anchor" "client_comm_due_anchor" DEFAULT 'none' NOT NULL,
  "event_type_scope" "client_comm_event_type_scope" DEFAULT 'all' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_date" timestamptz DEFAULT now(),
  "updated_date" timestamptz DEFAULT now(),
  "created_by" uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_communication_stage_defs_slug_uidx"
  ON "client_communication_stage_defs" ("slug");

CREATE TABLE IF NOT EXISTS "event_client_communication_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "def_id" uuid NOT NULL REFERENCES "client_communication_stage_defs"("id") ON DELETE RESTRICT,
  "title" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "template_subject" varchar(500),
  "template_body" text DEFAULT '' NOT NULL,
  "assigned_user" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_date" timestamptz,
  "status" "client_comm_stage_status" DEFAULT 'pending' NOT NULL,
  "completed_at" timestamptz,
  "completed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_date" timestamptz DEFAULT now(),
  "updated_date" timestamptz DEFAULT now(),
  "created_by" uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_client_comm_stages_event_def_uidx"
  ON "event_client_communication_stages" ("event_id", "def_id");
