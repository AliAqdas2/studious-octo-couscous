-- Plan 06: post_event jsonb + event ops feature flags

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "post_event" jsonb;--> statement-breakpoint

ALTER TABLE "automation_config"
  ADD COLUMN IF NOT EXISTS "event_ops_features" jsonb DEFAULT '{}'::jsonb;
