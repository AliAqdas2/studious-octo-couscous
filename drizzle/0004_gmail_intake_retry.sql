DO $$ BEGIN
  ALTER TYPE "gmail_message_status" ADD VALUE 'failed';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gmail_intake_retries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gmail_message_id" varchar(255) NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "next_retry_at" timestamptz NOT NULL,
  "source" "gmail_message_source",
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "gmail_intake_retries_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gmail_intake_dead_letters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gmail_message_id" varchar(255) NOT NULL,
  "from" varchar(500),
  "subject" varchar(500),
  "body" text,
  "thread_id" varchar(255),
  "snippet" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "source" "gmail_message_source",
  "failed_at" timestamptz NOT NULL,
  "alert_sent_at" timestamptz,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "updated_date" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "gmail_intake_dead_letters_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
