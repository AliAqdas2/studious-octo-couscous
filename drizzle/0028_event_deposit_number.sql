-- CRM-06: invoice / deposit number on events + backfill from linked leads

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deposit_number" varchar(255);--> statement-breakpoint

UPDATE events e
SET deposit_number = l.deposit_number
FROM leads l
WHERE e.deposit_number IS NULL
  AND l.deposit_number IS NOT NULL
  AND l.deposit_number <> ''
  AND (
    e.lead_id = l.id
    OR e.source_lead_id = l.id
    OR l.converted_to_event_id = e.id
  );
