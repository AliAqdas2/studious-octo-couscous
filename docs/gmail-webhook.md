# Gmail webhook & inbox → lead (how it works)

This document describes the **end-to-end** path from a new email in the shared CRM Gmail inbox to a Lead (or Spam / append) in Mangia CRM — including how Google notifies the app, what the webhook actually receives, and the backup poller.

Related setup steps: [`gmail-setup.md`](./gmail-setup.md).

---

## Big picture

```text
┌─────────────┐     new mail      ┌──────────────┐
│ Shared Gmail│ ───────────────► │ Gmail API    │
│  (INBOX)    │                  │ users.watch  │
└─────────────┘                  └──────┬───────┘
                                        │ publishes tiny notice
                                        │ (historyId only)
                                        ▼
                                 ┌──────────────┐
                                 │ Google Pub/Sub│
                                 │ topic + PUSH  │
                                 │ subscription  │
                                 └──────┬───────┘
                                        │ HTTPS POST
                                        ▼
                         ┌──────────────────────────┐
                         │ Mangia CRM               │
                         │ POST /webhook/gmail      │
                         │  1. decode Pub/Sub       │
                         │  2. history.list → IDs   │
                         │  3. handleContactForm…   │
                         │  4. Lead / Spam / skip   │
                         └──────────────────────────┘
```

**Important:** The Pub/Sub message does **not** contain the email body. It is only a wake-up: “something changed in this mailbox; latest history cursor is X.” Mangia then calls Gmail `history.list` / `messages.get` using the stored OAuth tokens to fetch real messages and run intake.

---

## Prerequisites (before any notification arrives)

| Piece | Why |
|-------|-----|
| Admin OAuth → `gmail_connections` | CRM can call Gmail as the shared mailbox |
| `GMAIL_PUBSUB_TOPIC` | Topic Gmail publishes to when INBOX changes |
| Pub/Sub **push** subscription → `https://YOUR_HOST/webhook/gmail` | Google HTTP-posts to your server |
| `POST /api/gmail/watch` (JWT) | Registers `users.watch` for that mailbox (~7 day expiry; auto-renewed by jobs) |
| `ANTHROPIC_API_KEY` (etc.) | LLM classifies / extracts lead fields |
| **`ENABLE_JOBS=true`** | Poller safety net + **watch auto-renewal** + **OAuth token keep-alive** |

Without **watch + Pub/Sub**, OAuth alone still supports send/draft/reply; it does **not** auto-create leads from new mail (unless you hit the webhook manually or run the poller).

---

## 1. Registering the watch

Authenticated admin calls:

```http
POST /api/gmail/watch
Authorization: Bearer <access_token>
```

Server code (`server/services/gmail/watch.ts`, called from `POST /api/gmail/watch`):

1. Reads `GMAIL_PUBSUB_TOPIC` (e.g. `projects/PROJECT/topics/gmail-crm-push`).
2. Calls Gmail `users.watch` with:
   - `topicName` = that topic  
   - `labelIds: ["INBOX"]`  
   - `labelFilterBehavior: "include"`  
3. Stores the returned `historyId` in `gmail_poll_state` (`last_history_id`), stamps `last_webhook_received_at`, and persists **`watch_expiration`** / **`watch_registered_at`**.

From then on, when mail hits **INBOX** for that mailbox, Gmail publishes to the topic.

Watch **expires ~7 days**. With `ENABLE_JOBS=true`, `renewGmailWatch` runs daily (3:30 AM ET) and renews when expiry is missing or under 48 hours away. A one-shot renew also runs ~30s after boot. You can still call `POST /api/gmail/watch` manually.

---

## 2. What Google sends to `/webhook/gmail`

### Transport

- Method: `POST`
- Path: `/webhook/gmail` (mounted in Express; **no JWT** — public webhook)
- Body: Google Cloud Pub/Sub **push** envelope (JSON)

### Optional shared secret

If `GMAIL_WEBHOOK_SECRET` is set, the request must send the same value in:

```http
X-Gmail-Webhook-Secret: <secret>
```

If the env var is empty, the webhook accepts all callers (rely on network / URL secrecy).

### Pub/Sub envelope shape (simplified)

```json
{
  "message": {
    "data": "<base64>",
    "messageId": "...",
    "publishTime": "..."
  },
  "subscription": "projects/.../subscriptions/..."
}
```

Decoded `data` is typically:

```json
{
  "emailAddress": "inbox@yourdomain.com",
  "historyId": 1234567890
}
```

Again: **no subject, no body, no From** — only a history cursor hint.

### Alternate bodies (testing / poller)

The same route also accepts:

```json
{ "data": { "new_message_ids": ["MESSAGE_ID_1", "MESSAGE_ID_2"] } }
```

or `{ "messageIds": [...] }` / `{ "new_message_ids": [...] }` — useful for manual replay without Pub/Sub.

Poller may post with `"source": "poller"` (internal / authenticated poll path uses the same intake function).

---

## 3. What the webhook handler does (step by step)

File: [`server/routes/webhooks/gmail.ts`](../server/routes/webhooks/gmail.ts)

### A. Auth / logging

1. Optional secret check.  
2. Verbose `[gmail-webhook]` logs (headers, full body, timings).

### B. Resolve Gmail message IDs

`resolveMessageIds(body)`:

1. **If body already has message IDs** → use them (`direct_body_ids`).  
2. **Else if Pub/Sub `message` present:**
   - Base64-decode `message.data` → read `historyId` hint (logged; intake still uses **stored** cursor).  
   - Load `gmail_poll_state.last_history_id`.  
   - **If no cursor yet:** seed with `users.getProfile` historyId, update poll state, return **zero** messages this hit (first notification only initializes the cursor).  
   - **Else:** call `listNewInboxMessageIds(startHistoryId, max=20)` → Gmail `users.history.list` with `historyTypes: ["messageAdded"]`, collect new message IDs, advance `last_history_id` and `last_webhook_received_at`.

### C. Deduplicate

For each candidate ID, skip if already in `processed_gmail_messages`.

### D. Run intake

```ts
handleContactFormEmail({
  messageIds: toProcess,
  source: "webhook" | "poller",
  markWebhook: true for webhook,
})
```

### E. Respond

Returns JSON like:

```json
{
  "ok": true,
  "created": 1,
  "spam": 0,
  "skipped": 0,
  "results": [ { "messageId": "...", "outcome": "created", "lead_id": "..." } ]
}
```

Pub/Sub expects a **2xx** quickly enough; long LLM runs can make Google retry — design keeps processing in the request today (watch timeouts / retries in production).

---

## 4. Intake pipeline (`handleContactFormEmail`)

File: [`server/services/gmail/handleContactFormEmail.ts`](../server/services/gmail/handleContactFormEmail.ts)

For **each** Gmail message ID:

### 1) Load message

`gmail.users.messages.get({ id, format: "full" })` using the shared mailbox OAuth client.

Parse `From`, `Subject`, `To`/`Cc`, decode body (HTML/text parts).

### 2) Hard filters (no LLM yet)

Examples:

| Check | Typical outcome |
|-------|-----------------|
| Already in `processed_gmail_messages` | skip |
| Website form sender (`itsupport@…`) but body isn’t a contact-form shape | ignore |
| Silent skip (auto-replies, etc.) | ignore |
| Mangia only on **Cc** (not To) | spam / ignore path |
| Same Gmail thread as existing lead | **append** note to that lead |
| Bulk / list headers | spam |
| Keyword spam heuristics | spam |

### 3) Candidate matching

For non-form mail: find possible existing leads by email, name, company text, domain (non-generic).

### 4) LLM classify + extract

Requires AI configured (`ANTHROPIC_API_KEY`, etc.).

Model returns category, business potential, whether it’s a **new** lead, and fields (name, email, company, inquiry type, …).

Then:

| Decision | Action |
|----------|--------|
| Continuation of existing lead | Append to best candidate lead |
| Not business / junk categories | Insert **Spam Emails** row |
| Valid new inquiry | Create **Lead** |

### 5) On new Lead create

1. `enrichLeadOnCreate` — B2B/B2C channel, returning-client match, stage tweaks.  
2. Insert lead + activity logs + Auto-Classification log.  
3. Mark message processed as `lead`.  
4. `scheduleOnLeadCreated` — auto-call (with skip guards).  
5. `detectReturningClient` — create/link **Client** row.

### 6) Idempotency

`processed_gmail_messages` stores `gmail_message_id` + status (`lead` | `spam` | `ignored`) so webhooks/poller retries don’t double-create.

---

## 5. Backup: poller (when webhooks are quiet)

Job: [`server/jobs/pollGmailInbox.ts`](../server/jobs/pollGmailInbox.ts)  
Cron: every **15 minutes** when `ENABLE_JOBS=true`.

Logic:

1. Read `gmail_poll_state.last_webhook_received_at`.  
2. If a webhook hit within the last **90 minutes** → skip (webhook considered healthy).  
3. Else → same `history.list` → `handleContactFormEmail` path as the webhook (source `poller`).

Manual trigger: `POST /api/gmail/poll` (auth required).

So: **Pub/Sub is near-real-time**; **poller is the safety net**.

### Connection keep-alive (also behind `ENABLE_JOBS`)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `renewGmailWatch` | Daily 3:30 AM ET (+ ~30s after boot) | Re-register `users.watch` before the ~7 day expiry |
| `checkGmailConnection` | Hourly at :15 (+ boot) | Force-refresh the OAuth access token so the refresh token does not go stale; on failure, persist `last_connection_error` and email `DIGEST_RECIPIENTS` (deduped every 12h). Failures are always logged as `[gmail-health]`. |

Google refresh tokens can expire after long disuse (and sooner while the OAuth consent screen is in **Testing**). The hourly refresh exercises the token so a connected mailbox stays connected.

### Intake retry + dead-letter (no email loss)

When AI classification, DB writes, or Gmail fetch fails during intake:

1. **Attempt 1** — normal webhook/poller processing.
2. **Attempts 2–3** — `retryGmailIntake` job (every 5 min) re-fetches the message by Gmail message ID from `gmail_intake_retries` (not `history.list`, so cursor advancement does not lose the email).
3. **After 2 failed retries** (3 total attempts) — full email snapshot saved to `gmail_intake_dead_letters`, terminal `failed` row in `processed_gmail_messages`, admin alert emailed to `DIGEST_RECIPIENTS`.

| Job | Schedule | Purpose |
|-----|----------|---------|
| `retryGmailIntake` | Every 5 min | Re-run intake on due retry rows (max 10/run) |

Log prefixes: `[retry-gmail-intake]`, `[gmail-intake-dead-letter]`.

---

## 6. State tables involved

| Table / store | Role |
|---------------|------|
| `gmail_connections` | OAuth tokens for the shared mailbox |
| `gmail_poll_state` | `last_history_id`, `last_webhook_received_at`, `last_polled_at`, `watch_expiration`, `last_token_refresh_at`, `last_connection_error` |
| `processed_gmail_messages` | Per-message idempotency (`lead`, `spam`, `ignored`, `failed`) |
| `gmail_intake_retries` | Pending re-attempts after transient intake errors |
| `gmail_intake_dead_letters` | Preserved email body when all retries exhausted |
| `leads` / `spam_emails` / `activity_logs` / `clients` | Intake outcomes |

---

## 7. Sequence (happy path)

```text
1. Customer emails info@… (or form forwards into INBOX)
2. Gmail watch fires → Pub/Sub topic
3. Push subscription POSTs /webhook/gmail with base64 { historyId }
4. CRM loads last_history_id from DB
5. history.list(startHistoryId) → ["msg_abc", ...]
6. For msg_abc: messages.get → filters → LLM → insert Lead
7. processed_gmail_messages ← msg_abc / lead
8. Client auto-create/link + optional auto-call
9. CRM returns 200 JSON summary to Pub/Sub
```

---

## 8. Failure modes (what you’ll see)

| Symptom | Likely cause |
|---------|----------------|
| No webhook logs at all | Push URL wrong / not public HTTPS; watch expired; topic permissions |
| Webhook hits but `created: 0`, empty IDs | Cursor seed-only first hit; or history already consumed; or no `messageAdded` |
| Fetch / OAuth errors | Gmail disconnected or token revoked |
| 503 AI not configured | Missing `ANTHROPIC_API_KEY` on create path |
| Duplicate prevention | Row already in `processed_gmail_messages` |
| AI/DB error on intake | Retried up to 2 times (3 total attempts) via `gmail_intake_retries`; then dead-letter + admin email — body preserved in DB |
| Poller always skipping | Webhooks healthy (&lt; 90 min since last hit) — expected |

Server logs use prefixes:

- `[gmail-webhook]` — HTTP / Pub/Sub / ID resolution  
- `[email-intake]` — per-message filters, LLM, lead create  
- `[poll-gmail]` — cron safety net  
- `[gmail-watch]` — watch renewal  
- `[gmail-health]` — OAuth keep-alive / disconnect alerts  
- `[retry-gmail-intake]` — scheduled intake retries  
- `[gmail-intake-dead-letter]` — exhausted retries; email preserved  

---

## 9. Code map

| Concern | Location |
|---------|----------|
| Pub/Sub push route | `server/routes/webhooks/gmail.ts` |
| Register watch / manual poll | `server/routes/gmail.ts` → `services/gmail/watch.ts` |
| Intake + history.list helpers | `server/services/gmail/handleContactFormEmail.ts` |
| OAuth / Gmail client | `server/services/gmail/gmailClient.ts` |
| Poller cron | `server/jobs/pollGmailInbox.ts` → `startJobs.ts` |
| Watch renew + token health | `server/jobs/renewGmailWatch.ts`, `server/jobs/checkGmailConnection.ts` |
| Intake retry + dead-letter | `server/services/gmail/intakeRetry.ts`, `server/jobs/retryGmailIntake.ts` |
| Forgot-password OTP | `server/services/auth/passwordReset.ts` |
| Setup checklist | `docs/gmail-setup.md` |

---

## 10. Mental model (one sentence)

**Gmail doesn’t push emails into Mangia — it pokes Pub/Sub; Mangia wakes up, walks Gmail history with the CRM mailbox token, then classifies each new message into Lead, Spam, or append.**
