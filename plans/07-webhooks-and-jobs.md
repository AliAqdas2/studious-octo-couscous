# 07 — Webhooks & Background Jobs

External webhooks and scheduled jobs that run without direct UI invocation.

## Webhook routes

Mount at `/webhook/*` (not `/api/*`) — no session auth, use signature verification.

```
POST   /webhook/twilio/voice
POST   /webhook/twilio/status
POST   /webhook/twilio/business-profile
POST   /webhook/fareharbor
POST   /webhook/gmail                   Gmail Pub/Sub push (optional)
```

## Twilio webhooks

See [04-twilio-calls.md](./04-twilio-calls.md).

- Validate `X-Twilio-Signature`
- Update `call_logs` status
- Write `twilio_webhook_logs` for business profile events

## FareHarbor webhook

Port `fareharborWebhook/entry.ts`:

**Route**: `POST /webhook/fareharbor`

1. Parse booking payload (`booking.created`, `booking.updated`, `booking.cancelled`)
2. Insert `fareharbor_events` row with `rawPayload`
3. Optionally match to existing `events` or create lead

Auth: shared secret header or IP allowlist.

## Gmail poller

**Job**: `pollGmailInbox` — cron every 10 minutes

Port from Base44:

1. Read `gmail_poll_state` singleton
2. If `last_webhook_received_at` < 90 min ago, skip (webhook healthy)
3. Gmail `history.list` since `last_history_id`
4. For each new message → `handleContactFormEmail` logic
5. Update `last_history_id`, `last_polled_at`

## Scheduled call retries

**Job**: `processScheduledCallRetries` — cron every 5 minutes

1. Query `call_logs` where `scheduled_retry_at <= now()` and `retry_processed = false`
2. Re-invoke `triggerCall` for lead
3. Set `retry_processed = true`

## Daily digest

**Job**: `sendDailyDigest` — cron daily 8 AM ET

Port from Base44 — email summary of new leads, tasks due, etc. to rep email from `automation_config`.

## Job runner options

| Option | Complexity | Recommendation |
|--------|------------|----------------|
| `node-cron` in Express process | Low | **MVP** |
| `bullmq` + Redis | Medium | Production scale |
| Separate worker process | Medium | When jobs are heavy |

### MVP setup

```ts
// server/jobs/index.ts
import cron from 'node-cron';

export function startJobs() {
  cron.schedule('*/10 * * * *', pollGmailInbox);
  cron.schedule('*/5 * * * *', processScheduledCallRetries);
  cron.schedule('0 8 * * *', sendDailyDigest, { timezone: 'America/New_York' });
}
```

Call `startJobs()` from `server/index.ts` after listen (production only, or flag `ENABLE_JOBS=true`).

## Entity-triggered jobs (not cron)

| Trigger | Job |
|---------|-----|
| `POST /api/leads` | `onLeadCreated` (async) |
| Lead stage change | `sendStageEmail` |
| Call no-answer webhook | `sendSurveyEmailOnNoAnswer` |
| Meeting reply email | `handleMeetingConfirmationReply` |

Use `setImmediate` or job queue — don't block HTTP.

## Logging & monitoring

- Log job start/end with duration
- On failure: log to `activity_logs` or structured console
- Health endpoint: `GET /api/health` includes `jobs: { last_poll: timestamp }`

## Files to create

```
server/routes/webhooks/fareharbor.ts
server/routes/webhooks/twilio.ts
server/routes/webhooks/gmail.ts
server/jobs/index.ts
server/jobs/pollGmailInbox.ts
server/jobs/processScheduledCallRetries.ts
server/jobs/sendDailyDigest.ts
server/lib/verifyTwilioSignature.ts
```

## Verification

- [ ] Twilio webhook updates call status
- [ ] FareHarbor booking stored in fareharbor_events
- [ ] Poller skips when webhook recent
- [ ] Poller creates lead from contact form email
- [ ] Retry job fires scheduled calls
- [ ] Jobs don't run in test environment
