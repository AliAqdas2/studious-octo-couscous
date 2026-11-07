-- CRM-15: separate attendee Email (not mapped into phone)

ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "email" varchar(255);
