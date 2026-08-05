ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "dead_letter_alert_sent_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "last_dead_letter_error" text;
