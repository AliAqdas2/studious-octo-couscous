CREATE INDEX IF NOT EXISTS "activity_logs_timestamp_idx" ON "activity_logs" ("timestamp" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_logs_status_ended_at_idx" ON "call_logs" ("status", "ended_at" DESC);
