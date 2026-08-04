CREATE TABLE IF NOT EXISTS "password_reset_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "ip" varchar(64),
  "user_agent" text
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "password_reset_codes"
  ADD CONSTRAINT "password_reset_codes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "watch_expiration" timestamptz;
--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "watch_registered_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "last_token_refresh_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "last_connection_error" text;
--> statement-breakpoint
ALTER TABLE "gmail_poll_state" ADD COLUMN IF NOT EXISTS "disconnect_alert_sent_at" timestamptz;
