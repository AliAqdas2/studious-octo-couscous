# Automated Call System — Detailed Test Plan

> End-to-end test cases for Mangia DC's automated outbound calling flow.
> Each test specifies **what the rep does**, **what the lead does**, **what they should say**,
> and the **expected system behavior** (CallLog state, Lead state, emails, retries, recordings).

---

## 0. Setup & Prerequisites

Before running any test, verify the following in **Admin → Automated Calls → Automation Config**:

| Field | Required Value |
|---|---|
| Automated Calling | **Enabled** (toggle ON) |
| Business Hours Gate | Toggle ON or OFF depending on test |
| Rep Phone | A real US phone you can answer (E.164 normalized) |
| Rep Email | A real inbox you can monitor |
| Calendar Link | A working Calendly/booking URL |
| Trigger Prefix | `ALITEST` |
| Max Attempts | `3` |

Confirm these secrets exist: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `APP_URL`, `DEEPGRAM_API_KEY`.

**Test lead template** — when a test says "create a trigger lead", create a Lead with:
- `name`: `ALITEST <scenario-name>` (e.g. `ALITEST Happy Path 1`)
- `company`: starts with `ALITEST`
- `phone`: a real phone you can answer (or a known unreachable number for negative tests)
- `email`: a real inbox you control

---

## 1. Trigger Conditions

### TC-1.1 — Lead triggers a call (happy condition)
- **Action**: Create a Lead with company `ALITEST Trigger Co`, a valid US phone, and your test email.
- **Expected**:
  - `onLeadCreated` fires → invokes `triggerCallTwiML`.
  - A `CallLog` row appears in the dashboard with status `Initiated` → `Ringing`.
  - Lead `stage` becomes `Call Initiated`.

### TC-1.2 — Lead does NOT trigger a call (wrong prefix)
- **Action**: Create a Lead with company `Acme Corp` (no `ALITEST` prefix).
- **Expected**:
  - No `CallLog` created.
  - Lead stays in default stage (`New Inquiry`).

### TC-1.3 — Master switch disabled
- **Action**: Turn **Automated Calling** toggle OFF. Create an `ALITEST` lead.
- **Expected**:
  - No `CallLog` is created.
  - No call is placed.
  - Log message: `Skipped — automated calling is disabled`.

### TC-1.4 — Lead missing phone number
- **Action**: Create `ALITEST No Phone` lead with `phone` blank.
- **Expected**:
  - A `CallLog` is created with status `Failed`, `error_message`: "Lead has no valid phone number".
  - No outbound call placed.

### TC-1.5 — Lead with invalid phone format
- **Action**: Create lead with phone `12345` (too short).
- **Expected**: Same as TC-1.4 — `Failed` + descriptive error.

---

## 2. Business Hours Gate

### TC-2.1 — Inside business hours (gate ON)
- **Time**: Mon–Fri, between 7:30 AM and 8:30 PM **America/New_York**.
- **Action**: Trigger a lead.
- **Expected**: Call is placed immediately. `CallLog` status moves `Initiated` → `Ringing`.

### TC-2.2 — Outside business hours (gate ON, evening)
- **Time**: Mon–Fri, after 8:30 PM DC time.
- **Action**: Trigger a lead.
- **Expected**:
  - `CallLog` row created with status `Initiated`, `scheduled_retry_at` set to **next morning 7:30 AM DC time** (in UTC).
  - `error_message`: "Queued — outside DC business hours…"
  - Row appears in the amber **Queued Calls** panel.
  - ActivityLog entry: "Call Queued (Outside Business Hours)".
  - **No** call placed yet.

### TC-2.3 — Weekend (gate ON)
- **Time**: Saturday or Sunday.
- **Action**: Trigger a lead.
- **Expected**: Queued for **Monday 7:30 AM DC time**.

### TC-2.4 — Early morning (gate ON, before 7:30 AM)
- **Time**: Mon–Fri, 6:00 AM DC time.
- **Action**: Trigger a lead.
- **Expected**: Queued for **today 7:30 AM DC time**.

### TC-2.5 — Gate OFF
- **Action**: Turn **Business Hours Gate** OFF. Trigger a lead at 11 PM Saturday.
- **Expected**: Call is placed immediately, no queuing.

### TC-2.6 — Queue release & spacing
- **Setup**: Queue 3 leads while gate is ON (use TC-2.2 method).
- **Action**: Wait for the next business window start. `processScheduledCallRetries` runs every 5 min.
- **Expected**:
  - Calls dial out **30 seconds apart** (not all at once).
  - Each `CallLog` flips `retry_processed=true`, `scheduled_retry_at=null` BEFORE its call is invoked (so no double-dial).
  - Oldest-scheduled lead goes first.

---

## 3. Rep-Answer Stage (`rep_answer` / `rep_gather`)

> **What the rep hears** (first attempt): *"Hi there. This is Mangia DC calling with a warm new lead. **[lead name]** from **[company]** is on the line and ready to chat. Press 1 to accept the call, or press 2 to decline."*

### TC-3.1 — Rep accepts (presses 1)
- **Rep action**: Answer phone, listen to prompt, press **1**.
- **Expected**:
  - Rep hears: *"Great. Connecting you now. Please hold."*
  - System dials the lead.
  - `CallLog.status` = `In Progress`.

### TC-3.2 — Rep declines (presses 2)
- **Rep action**: Answer phone, press **2**.
- **Expected**:
  - Rep hears: *"Call declined. Goodbye."*
  - `CallLog.status` = `Rep Declined`.
  - Rep gets an email: **"[Declined] Lead call for [name]"** with lead phone for manual follow-up.
  - **Lead is NOT called.**

### TC-3.3 — Rep presses invalid digit (e.g. 5)
- **Rep action**: Press **5**.
- **Expected**:
  - System re-prompts: *"Are you still there? Press 1 to connect… or press 2 to decline."*
  - Re-prompt repeats up to **5 attempts** total.
  - If still no valid input after attempt 5 → hangup, `CallLog.status` = `Rep Declined`, "no input" email to rep.

### TC-3.4 — Rep doesn't press anything (timeout)
- **Rep action**: Answer the phone, stay silent for 8+ seconds.
- **Expected**:
  - After 8s timeout → next attempt prompt.
  - After 5 silent rounds → hangup, `Rep Declined`, **"[Missed] Lead call… no response"** email.

### TC-3.5 — Rep doesn't pick up (no-answer)
- **Rep action**: Don't answer the phone. Let it ring out (Twilio rings for 20s).
- **Expected**:
  - `CallLog.status` = `No Answer`.
  - `scheduled_retry_at` set to **+1 hour** (only if no prior retry exists for this lead).
  - Email to rep: **"[No Answer] Lead call for [name]"** mentioning auto-retry in 1 hour.
  - After 1 hour, `processScheduledCallRetries` picks it up and re-dials.

### TC-3.6 — Rep phone busy
- **Rep action**: Be on another call when system dials.
- **Expected**: Same as TC-3.5 but status = `Busy`.

### TC-3.7 — Rep phone fails (invalid number, off)
- **Expected**: `CallLog.status` = `Failed`, retry scheduled if no prior, email sent.

### TC-3.8 — Rep number is voicemail
- **Rep action**: Let it go to voicemail.
- **Expected**: Twilio may report `completed` with no digits → falls through to no-input flow → `Rep Declined`.

---

## 4. Lead-Answer Stage (`dial_complete`)

> Once rep presses 1, the system bridges the rep with the lead and **records both sides**.

### TC-4.1 — Lead answers & talks (happy path)
- **Rep should say** when lead picks up:
  > *"Hi [Lead Name], this is [Rep Name] from Mangia DC — I'm following up on your inquiry. Do you have a couple of minutes to chat about your event?"*
- **Lead should** engage with realistic answers (budget, headcount, timing, event type).
- **Rep should** ask:
  1. *"What kind of event are you planning?"* (e.g. Mixology, Paint & Sip)
  2. *"Roughly how many people?"*
  3. *"Do you have a date or window in mind?"*
  4. *"What's your approximate budget?"*
  5. *"Is this an in-person, virtual, or hybrid event?"*
- **End call**: Rep says *"Great, I'll send you a proposal and follow-up email. Talk soon!"* then hang up.
- **Expected**:
  - `CallLog.status` = `Completed`.
  - Recording uploaded → `recording_url` populated.
  - Deepgram transcribes → `transcript` populated.
  - `analyzeCall` LLM extracts → `summary`, `extracted_budget`, `extracted_headcount`, `extracted_timing`, `extracted_next_stage`, `extracted_notes`.
  - Lead `stage` advances to the extracted next stage (e.g. `Program Planning Discussion`, `Proposal Sent`).
  - `CallLog.status` → `Analyzed`.

### TC-4.2 — Lead doesn't answer (no-answer)
- **Lead action**: Don't pick up.
- **Expected**:
  - Rep hears: *"The lead did not accept the call. We are sending you the lead details by email so you can follow up directly. Goodbye."*
  - `CallLog.status` = `No Answer`.
  - Email to rep: **"[No Answer] [Lead Name] did not pick up"** with phone & retry instructions.
  - `sendSurveyEmailOnNoAnswer` fires → creates a **Gmail draft** proposing a meeting time.
  - Lead `awaiting_meeting_confirmation` = `true`.
  - ActivityLog entry created.

### TC-4.3 — Lead busy
- **Lead action**: Have another call active.
- **Expected**: Rep hears *"The lead line was busy…"*. Status = `Busy`. Same fallback survey draft as TC-4.2.

### TC-4.4 — Lead declines (rejects call mid-ring)
- **Lead action**: Decline the incoming call on phone.
- **Expected**: Status = `No Answer` or `Failed` (Twilio reports `canceled`). Same fallback flow.

### TC-4.5 — Lead answers then hangs up immediately
- **Lead action**: Pick up, immediately hang up (≤ 2 seconds).
- **Expected**:
  - Status = `Completed`.
  - Recording exists but is very short.
  - `analyzeCall` runs → transcript may be empty or near-empty → LLM returns minimal extraction → status stays `Completed` (not blocked). No stage advance if `extracted_next_stage` is empty.

### TC-4.6 — Lead voicemail picks up
- **Lead action**: Let it go to voicemail; voicemail greeting plays.
- **Expected**:
  - Twilio reports `completed` (because voicemail picked up).
  - Recording captures the voicemail greeting + any rep message.
  - `analyzeCall` transcribes, LLM should not extract real lead data; stage stays unchanged.
  - **Operator note**: This is a known edge case — rep should hang up quickly if they realize it's voicemail.

### TC-4.7 — Lead number invalid / disconnected
- **Expected**: Status = `Failed`. Fallback email survey **still attempted** (since `sendSurveyEmailOnNoAnswer` doesn't require a valid phone). Rep gets failure email.

---

## 5. Recording & Transcription

### TC-5.1 — Recording completes successfully
- **Expected**:
  - Twilio fires `stage=recording` webhook with `RecordingStatus=completed`.
  - `recording_url` saved on `CallLog`.
  - `analyzeCall` is invoked.
  - Recording is downloadable from `CallLog` detail page.

### TC-5.2 — Recording status not `completed`
- **Trigger**: Recording fails (rare — network issue on Twilio side).
- **Expected**: Webhook returns 200 with no action. `recording_url` stays empty. `CallLog.status` reflects last known state.

### TC-5.3 — Deepgram returns empty transcript
- **Trigger**: Silent recording (TC-4.5 scenario).
- **Expected**: `analyzeCall` flags it, LLM extraction skipped or returns empty fields. Status `Completed` (not `Analyzed`) — no false stage advance.

### TC-5.4 — Deepgram API failure
- **Trigger**: Invalid `DEEPGRAM_API_KEY` or rate limit.
- **Expected**: `analyzeCall` catches the error, logs it, `CallLog.error_message` populated. No crash.

---

## 6. Email Fallback Flow (No-Answer Survey)

### TC-6.1 — Draft created when lead doesn't pick up
- **Setup**: Trigger TC-4.2.
- **Expected**:
  - Gmail draft visible in connected mailbox.
  - Draft addressed to the lead, **proposes a meeting time** (with editable placeholder).
  - Lead `awaiting_meeting_confirmation` = `true`.
  - Internal notification email sent to team.

### TC-6.2 — Rep edits & sends draft
- **Rep action**: Open Gmail draft, replace the time placeholder with a real time, send.
- **Lead action**: Reply with *"Yes, that works!"*
- **Expected**:
  - `handleMeetingConfirmationReply` (Gmail webhook) parses reply.
  - LLM classifies = `confirmed`, extracts proposed time from rep's sent email.
  - Lead `stage` → `Program Planning Discussion`.
  - Lead `meeting_date` = extracted time.
  - `awaiting_meeting_confirmation` = `false`.
  - **Calendar invite (.ics) sent** if lead name starts with `ALITEST`.

### TC-6.3 — Lead proposes alternative time
- **Lead reply**: *"That doesn't work. How about Thursday at 3 PM?"*
- **Expected**: Classification = `proposed_alternative`. `meeting_date` updated to Thursday 3 PM. Stage → `Program Planning Discussion`.

### TC-6.4 — Lead declines
- **Lead reply**: *"Thanks but we went with another vendor."*
- **Expected**: Classification = `declined`. Stage → `Lost/Canceled`. `lost_reason` set. `awaiting_meeting_confirmation` = `false`.

### TC-6.5 — Lead reply is ambiguous
- **Lead reply**: *"Let me check my calendar."*
- **Expected**: Classification = `unclear`. Flag stays set. Just an ActivityLog entry. No stage change.

---

## 7. Retry Logic

### TC-7.1 — Auto-retry after first No-Answer
- **Setup**: TC-3.5 occurs.
- **Expected**: `scheduled_retry_at` = now + 1 hour. After 1h, retry runs automatically.

### TC-7.2 — No retry on second failure (max 1 auto-retry)
- **Setup**: First attempt fails (TC-3.5), retry runs, that also fails.
- **Expected**: **No second auto-retry scheduled** (system checks `priorForLead` for any prior retry). Email tells rep "Please call them directly when you can."

### TC-7.3 — Manual retry from dashboard
- **Action**: Click **Retry** button on a failed call row.
- **Expected**: New `CallLog` row created via `triggerCallTwiML`. Original row untouched.

### TC-7.4 — Retry of a queued (business-hours) call
- **Action**: Click **Retry now** on a queued call.
- **Expected**: Triggers immediately, bypassing the scheduled time **if inside business hours** (otherwise re-queues).

### TC-7.5 — Multiple queued calls release in order, spaced
- **Setup**: Queue 5 calls outside business hours.
- **Expected**: At window start, calls go out **30s apart** in **oldest-scheduled-first** order.

---

## 8. Idempotency & Race Conditions

### TC-8.1 — Twilio retries a webhook
- **Trigger**: Manually re-fire the `dial_complete` webhook (simulate network blip).
- **Expected**: Second call updates `CallLog` to the same final state — no duplicate retries scheduled, no duplicate emails. (Note: current implementation sends an email each time `rep_status` fires for a terminal state, but `status === 'Initiated' || 'Ringing'` guard prevents most duplicates.)

### TC-8.2 — Scheduled retry processed twice
- **Trigger**: `processScheduledCallRetries` runs while a previous run is still in-flight.
- **Expected**: `retry_processed=true` is set **before** invoking `triggerCallTwiML`, so the second run sees zero due rows. No double-dial.

### TC-8.3 — Lead deleted before retry runs
- **Setup**: Queue a call, then delete the lead.
- **Expected**: `triggerCallTwiML` returns `Lead not found` 404. `CallLog` row is left in a stale state. (Acceptable — operator can clean up manually.)

---

## 9. Spoken Scripts (Reference)

### What the **rep** hears (system speech)

| Moment | Voice |
|---|---|
| First answer | *"Hi there. This is Mangia DC calling with a warm new lead. **[Name]** from **[Company]** is on the line and ready to chat. Press 1 to accept the call, or press 2 to decline."* |
| Retry prompt | *"Are you still there? Press 1 to connect with **[Name]**, or press 2 to decline."* |
| After pressing 1 | *"Great. Connecting you now. Please hold."* |
| After pressing 2 | *"Call declined. Goodbye."* |
| Lead no-answer | *"The lead did not accept the call. We are sending you the lead details by email so you can follow up directly. Goodbye."* |
| Lead busy | *"The lead line was busy and could not accept the call."* |
| Invalid digit (after retries exhausted) | *"Sorry, I did not catch that. Goodbye."* |

### What the **rep should say** to the lead

> *"Hi [Lead First Name], this is [Rep Name] from Mangia DC. I saw your inquiry come in — thanks for reaching out! Do you have a quick minute to chat about your event?"*

Then walk through:
1. Event type (Mixology / Paint & Sip / Food Tour / etc.)
2. Headcount estimate
3. Preferred date / window
4. In-person, virtual, or hybrid
5. Budget range
6. Decision timeline ("When are you looking to lock this in?")

Close with: *"Great — I'll send a follow-up email today with a proposal and a calendar link. Looking forward to it!"*

### What the **lead** should say (for full happy-path test)

> *"Hi, yes — we're planning a team event for about 20 people, sometime in [month]. Looking at a virtual mixology class. Budget is around $X."*

This gives the LLM enough signal to extract budget, headcount, timing, and event type.

---

## 10. Dashboard Verification Checklist

After each test, confirm in **Admin → Automated Calls**:

- [ ] **Call History** table shows the row with correct status, timestamp, rep info, attempt number.
- [ ] **Queued Calls** panel (amber) shows queued rows with correct `Scheduled For` and `In X minutes/hours`.
- [ ] **Needs Retry** panel (orange) shows unanswered calls with working **Retry Call** button.
- [ ] Clicking **View** opens `AutomatedCallDetail` with: status, recording player, transcript, LLM extraction, attempt history per lead.
- [ ] **ActivityLog** page shows entries for: call initiated, queued (if applicable), completed, stage changes.

---

## 11. Negative & Edge Cases

| ID | Scenario | Expected |
|---|---|---|
| TC-11.1 | `APP_URL` secret missing | `triggerCallTwiML` returns 500 "Twilio env vars (or APP_URL) not configured". No CallLog created. |
| TC-11.2 | Twilio account suspended | Twilio API returns error; CallLog status `Failed` with Twilio error message. |
| TC-11.3 | Lead phone is international (non-US, non-PK) | Normalizer returns null → `Failed` "Lead has no valid phone number". |
| TC-11.4 | Lead phone is Pakistani (starts `92`) | Accepted as-is, call placed. |
| TC-11.5 | Rep phone has formatting `(555) 123-4567` | Normalized to `+15551234567` before dialing. |
| TC-11.6 | Two leads with same company created back-to-back | Each gets its own `CallLog` & dial — no deduping (current design). |
| TC-11.7 | Lead created with `ALITEST` lowercase (`alitest`) | **Does NOT trigger** — prefix match is case-sensitive on company name. Verify with operator before fixing. |
| TC-11.8 | `AutomationConfig` row missing entirely | First call attempt returns 400 "AutomationConfig not set…" |
| TC-11.9 | Daylight Savings transition during queue wait | Queued time is stored as absolute UTC ISO — survives DST. Spot-check on next DST boundary. |

---

## 12. Smoke Test Sequence (run weekly)

A 10-minute regression sweep, all using your own phone as the rep and lead:

1. **TC-1.1 → TC-3.1 → TC-4.1**: Full happy path. Confirm recording, transcript, stage advance.
2. **TC-3.2**: Rep presses 2 — confirm decline email.
3. **TC-3.5**: Rep doesn't answer — confirm 1-hour retry scheduled.
4. **TC-4.2 → TC-6.2**: Lead doesn't answer → Gmail draft → rep sends → lead replies "yes" → confirm `meeting_date` set + ICS sent.
5. **TC-2.2**: Set system clock to a queued window — confirm row appears in Queued Calls panel.
6. **TC-1.3**: Toggle master switch OFF — confirm no new calls go out.

If all 6 pass → system is healthy.