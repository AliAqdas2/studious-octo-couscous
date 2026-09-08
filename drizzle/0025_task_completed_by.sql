ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
