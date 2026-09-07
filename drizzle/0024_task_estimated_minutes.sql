-- Workflow task planning: estimated duration in minutes
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_minutes" integer;
