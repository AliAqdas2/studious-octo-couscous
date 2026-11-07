-- CRM-08: QuickBooks payment/invoice URL on leads + events

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deposit_payment_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "deposit_payment_url" varchar(1024);--> statement-breakpoint

UPDATE events e
SET deposit_payment_url = l.deposit_payment_url
FROM leads l
WHERE e.deposit_payment_url IS NULL
  AND l.deposit_payment_url IS NOT NULL
  AND l.deposit_payment_url <> ''
  AND (
    e.lead_id = l.id
    OR e.source_lead_id = l.id
    OR l.converted_to_event_id = e.id
  );
