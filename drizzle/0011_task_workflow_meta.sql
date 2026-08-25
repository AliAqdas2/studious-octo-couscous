-- Plan 03: workflow_meta on tasks (staff status, supply pickup, ice)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_meta" jsonb DEFAULT '{}'::jsonb;
