# Automated Call System — Black-Box Test Cases

> Black-box = test from the **outside**. No internal state checks, no log inspection.
> Each test = **Inputs** + **Actions** + **Observable End Result** (what a user would actually see/hear/receive).

**Tester needs:**
- 📞 A phone you can answer as the **rep**
- 📞 A second phone you can answer as the **lead** (or a colleague's)
- 📧 Access to the **rep's email inbox**
- 📧 Access to the **lead's email inbox**
- 🖥️ Access to the **Automated Calls dashboard**

---

## Test BB-01 — Happy Path: Full Successful Call

**Inputs**
- Lead Name: `ALITEST Happy Path`
- Company: `ALITEST Catering`
- Phone: your lead test phone
- Email: your lead test inbox
- Time: weekday, 10:00 AM DC time

**Actions**
1. Create the lead in the Leads page.
2. Wait up to 30 seconds. **Rep phone rings.**
3. Rep answers, hears the prompt, presses **1**.
4. Lead phone rings. Lead answers.
5. Have a real 30-second conversation: *"We're planning a virtual mixology event for 25 people, budget around $2,000, looking at next month."*
6. Hang up.

**Expected End Result**
- ✅ Rep heard: *"Hi there. This is Mangia DC calling with a warm new lead. ALITEST Happy Path from ALITEST Catering is on the line…"*
- ✅ Lead heard the rep's voice within 5 seconds of answering.
- ✅ On the dashboard: **Call History** row shows **status = Completed** (then **Analyzed** within 1–2 min).
- ✅ Clicking **View** shows: recording playback, transcript, and extracted fields (budget ≈ $2000, headcount ≈ 25, event = mixology).
- ✅ The lead's pipeline stage **advanced** (e.g. to "Program Planning Discussion" or "Proposal Sent").

---

## Test BB-02 — Wrong Company Prefix → No Call

**Inputs**
- Lead Name: `John Doe`
- Company: `Acme Corp` *(no ALITEST prefix)*
- Phone + email: real

**Actions**
1. Create the lead.
2. Wait 2 minutes.

**Expected End Result**
- ✅ **No phone call** to the rep.
- ✅ **No row** in the Call History dashboard.
- ✅ Lead stays in default pipeline stage.

---

## Test BB-03 — Master Switch OFF → No Call

**Inputs**
- Config: turn **Automated Calling** toggle **OFF**.
- Lead: `ALITEST Switch Off`, valid phone.

**Actions**
1. Toggle off, click **Save Config**.
2. Create the lead.
3. Wait 2 minutes.

**Expected End Result**
- ✅ Rep phone **does not ring**.
- ✅ No Call History row created.
- ✅ Lead created normally in Leads page.

*(Cleanup: toggle back ON after this test.)*

---

## Test BB-04 — Rep Declines (Presses 2)

**Inputs**
- Lead: `ALITEST Decline Test`, valid phone.

**Actions**
1. Create lead. Rep phone rings.
2. Rep answers, presses **2**.

**Expected End Result**
- ✅ Rep hears: *"Call declined. Goodbye."*
- ✅ Lead phone **does not ring**.
- ✅ Rep receives email titled **`[Declined] Lead call for ALITEST Decline Test`** containing the lead's phone number.
- ✅ Dashboard row shows **status = Rep Declined**.

---

## Test BB-05 — Rep Doesn't Answer

**Inputs**
- Lead: `ALITEST Rep No Answer`.

**Actions**
1. Create lead. Rep phone rings.
2. **Do not answer.** Let it ring out (~20 seconds).

**Expected End Result**
- ✅ Rep receives email titled **`[No Answer] Lead call for ALITEST Rep No Answer`** mentioning auto-retry in 1 hour.
- ✅ Dashboard row shows **status = No Answer**.
- ✅ Dashboard shows **Next Retry: in about 1 hour** for that row.
- ✅ Approximately 1 hour later, **rep phone rings again** (auto-retry).

---

## Test BB-06 — Rep Stays Silent After Answering

**Inputs**
- Lead: `ALITEST Silent Rep`.

**Actions**
1. Create lead. Rep phone rings.
2. Answer, stay completely silent. Don't press anything.
3. Wait through 5 re-prompts (about 60 seconds total).

**Expected End Result**
- ✅ Rep hears the intro, then *"Are you still there?"* repeated up to 5 times.
- ✅ Eventually hears: *"No input received. Goodbye."*
- ✅ Lead is **not called**.
- ✅ Rep email: **`[Missed] Lead call for ALITEST Silent Rep — no response`**.
- ✅ Dashboard status = **Rep Declined**.

---

## Test BB-07 — Rep Presses Wrong Key Then Correct Key

**Inputs**
- Lead: `ALITEST Wrong Key`.

**Actions**
1. Create lead. Rep answers.
2. Press **5** (invalid). System re-prompts.
3. Press **1** on the second prompt.

**Expected End Result**
- ✅ Rep hears: intro → re-prompt → *"Great. Connecting you now."*
- ✅ Lead is called normally.
- ✅ Dashboard status reaches **Completed** after the call.

---

## Test BB-08 — Lead Doesn't Answer

**Inputs**
- Lead: `ALITEST Lead No Answer`, with a phone you **won't** answer.
- Lead email: real inbox you can check.

**Actions**
1. Create lead. Rep answers, presses **1**.
2. Lead phone rings — **do not answer**.

**Expected End Result**
- ✅ Rep hears: *"The lead did not accept the call. We are sending you the lead details by email so you can follow up directly. Goodbye."*
- ✅ Rep receives email: **`[No Answer] ALITEST Lead No Answer did not pick up`**.
- ✅ In the connected Gmail account, a **draft email** appears, addressed to the lead, **proposing a meeting time** with a placeholder.
- ✅ Dashboard status = **No Answer**.

---

## Test BB-09 — Lead Doesn't Answer → Rep Sends Draft → Lead Confirms

**Inputs**
- Continues from BB-08.

**Actions**
1. Open the Gmail draft. Replace the time placeholder with a real time (e.g. *"Thursday at 2 PM"*).
2. Send the email.
3. From the lead's inbox, reply: *"Yes, that works for me!"*
4. Wait 30 seconds.

**Expected End Result**
- ✅ The lead's record in the CRM updates: **stage = "Program Planning Discussion"** and **meeting date = Thursday at 2 PM**.
- ✅ The lead receives a **calendar invite (.ics)** in their inbox for that time *(only if lead name starts with ALITEST)*.

---

## Test BB-10 — Lead Doesn't Answer → Lead Declines via Email

**Inputs**
- Run BB-08 first.

**Actions**
1. Rep sends the meeting-proposal draft.
2. Lead replies: *"Thanks but we already went with someone else."*
3. Wait 30 seconds.

**Expected End Result**
- ✅ Lead's stage updates to **`Lost/Canceled`**.
- ✅ Lead's `Lost Reason` field populated with something like *"Lead declined meeting via email reply"*.

---

## Test BB-11 — Lead Has No Phone Number

**Inputs**
- Lead: `ALITEST No Phone`, **phone field blank**, email valid.

**Actions**
1. Create the lead.
2. Wait 1 minute.

**Expected End Result**
- ✅ Rep phone **does not ring**.
- ✅ Dashboard shows a row with **status = Failed**, **error = "Lead has no valid phone number"**.

---

## Test BB-12 — Outside Business Hours → Call Gets Queued

**Inputs**
- Config: **Business Hours Gate = ON**.
- Time: 11:00 PM DC time on a weekday (or any weekend time).
- Lead: `ALITEST After Hours`.

**Actions**
1. Create the lead.
2. Wait 1 minute.

**Expected End Result**
- ✅ Rep phone **does not ring** immediately.
- ✅ Dashboard's **Queued Calls** panel (amber) shows the lead with **Scheduled For = next weekday 7:30 AM DC time**.
- ✅ Dashboard's main row shows **Status = Initiated** with a "Next Retry" timestamp.
- ✅ At the scheduled time, **rep phone rings** automatically.

---

## Test BB-13 — Business Hours Gate OFF → Calls Anytime

**Inputs**
- Config: **Business Hours Gate = OFF**.
- Time: any (e.g. weekend, late night).
- Lead: `ALITEST Gate Off`.

**Actions**
1. Toggle gate OFF, save.
2. Create lead.

**Expected End Result**
- ✅ Rep phone rings within 30 seconds regardless of time.
- ✅ No row appears in Queued Calls panel.

*(Cleanup: turn gate back ON.)*

---

## Test BB-14 — Multiple Queued Calls Release with Spacing

**Inputs**
- Gate ON.
- Time: outside business hours.
- Create **3 leads** back-to-back: `ALITEST Queue 1`, `ALITEST Queue 2`, `ALITEST Queue 3`.

**Actions**
1. Create all three within 1 minute of each other.
2. Wait until the next business window opens (or temporarily turn gate OFF to simulate).

**Expected End Result**
- ✅ All 3 appear in the **Queued Calls** panel with staggered scheduled times.
- ✅ When released, rep phone rings for lead 1, then **~30 seconds later** for lead 2, then **~30 seconds later** for lead 3.
- ✅ Calls **do NOT all ring at once**.

---

## Test BB-15 — Manual Retry from Dashboard

**Inputs**
- A previously-failed call row (run BB-05 or BB-08 first).

**Actions**
1. Go to Automated Calls dashboard.
2. Find the failed row, click **Retry**.

**Expected End Result**
- ✅ Within 10 seconds, rep phone rings.
- ✅ A **new row** appears in the Call History (the old failed row stays).
- ✅ Toast notification: *"Retry initiated"*.

---

## Test BB-16 — Call Detail Page Shows Full Info

**Inputs**
- A completed call (from BB-01).

**Actions**
1. From the dashboard, click **View** on the completed row.

**Expected End Result**
- ✅ Page shows: lead name, company, phone, rep info, attempt number, status timeline.
- ✅ **Audio player** with the recording — plays the actual conversation.
- ✅ **Transcript** text matches what was said.
- ✅ **Extracted Info** section shows budget, headcount, timing, suggested next stage.

---

## Test BB-17 — Two Leads Created Simultaneously

**Inputs**
- Lead A: `ALITEST Concurrent A`
- Lead B: `ALITEST Concurrent B`

**Actions**
1. Create both leads within 5 seconds of each other.

**Expected End Result**
- ✅ Rep phone rings for **one** lead first.
- ✅ While rep is on that call, the **second call attempt is also placed** (Twilio handles it — rep's phone may show call waiting, or the second call may go to voicemail/no-answer).
- ✅ Both leads end up with a Call History row, each independently tracked.

*(Note: simultaneous handling is currently best-effort — both calls are placed; the rep's phone behavior depends on their carrier's call-waiting setup.)*

---

## Test BB-18 — Config Form Validation

**Inputs / Actions**
1. Go to Automated Calls page → Automation Config card.
2. Clear the **Rep Phone** field, click **Save Config**.
3. Create an `ALITEST` lead.

**Expected End Result**
- ✅ Config saves (no validation block).
- ✅ When the lead triggers, dashboard shows **status = Failed** with error mentioning *"AutomationConfig not set"* or *"Invalid rep_phone"*.

*(Cleanup: restore rep phone.)*

---

## Test BB-19 — Lead's Email Reply Is Ambiguous

**Inputs**
- Run BB-08 first; rep sends meeting draft.

**Actions**
1. Lead replies: *"Let me check my schedule and get back to you."*
2. Wait 1 minute.

**Expected End Result**
- ✅ Lead's **stage stays unchanged**.
- ✅ Lead's **`awaiting_meeting_confirmation` flag stays set** (so future replies still get parsed).
- ✅ Activity Log shows an entry: *"Meeting Reply Unclear (Awaiting Human)"*.

---

## Test BB-20 — Auto-Retry Does NOT Happen Twice

**Inputs**
- Lead: `ALITEST Double Retry`.

**Actions**
1. Create lead, **don't answer** rep phone (BB-05).
2. Wait 1 hour for auto-retry. **Don't answer again.**

**Expected End Result**
- ✅ First failure → email mentions auto-retry in 1 hour.
- ✅ Second failure → email tells rep *"Please call them directly when you can."* (no mention of another auto-retry).
- ✅ Dashboard shows **no further "Next Retry" countdown** for this lead.

---

## Test BB-21 — Rep Email Notifications Are Actually Delivered

**Inputs**
- Valid rep email in Config.

**Actions**
1. Run BB-04 (Rep Declined).
2. Run BB-05 (Rep No Answer).
3. Run BB-08 (Lead No Answer).
4. Check rep inbox.

**Expected End Result**
- ✅ Three emails received, each with subject prefix `[Declined]`, `[No Answer]`, or `[No Answer] ...did not pick up`.
- ✅ Each contains a clickable **`tel:` link** to call the lead directly.
- ✅ Emails render with proper line breaks (not one long blob).

---

## Test BB-22 — Lead with International (Non-US) Phone

**Inputs**
- Lead: `ALITEST International`, phone `+44 20 7946 0958` (UK).

**Actions**
1. Create the lead.

**Expected End Result**
- ✅ Dashboard row shows **status = Failed**, **error = "Lead has no valid phone number"** (US/PK only).
- ✅ Rep phone does **not** ring.

---

## Test BB-23 — Recording Plays Correctly

**Inputs**
- Any completed call from BB-01.

**Actions**
1. Open the call detail page.
2. Click play on the audio player.

**Expected End Result**
- ✅ Audio plays both sides of the conversation clearly.
- ✅ Audio is downloadable (right-click → save, or via the recording URL).

---

## Test BB-24 — Voicemail on Lead's Side

**Inputs**
- Lead: `ALITEST Voicemail`, phone goes to voicemail after a few rings.

**Actions**
1. Rep answers, presses 1.
2. Lead's voicemail picks up the call. Rep listens to ~5 sec of voicemail greeting then hangs up.

**Expected End Result**
- ✅ Dashboard shows **status = Completed** (Twilio treats voicemail pickup as a connected call).
- ✅ Recording exists but contains the voicemail greeting + silence.
- ✅ Lead's stage does **not** falsely advance (no real conversation = no extracted data).

---

## Smoke Test — Run Weekly (5 minutes)

Quick health check using your own phone as both rep and lead:

| Step | Test | Pass criteria |
|---|---|---|
| 1 | BB-01 | Full happy path works, stage advances, recording plays |
| 2 | BB-04 | Decline email arrives |
| 3 | BB-08 → BB-09 | Lead no-answer → draft created → confirmation parses correctly |
| 4 | BB-12 | Off-hours lead lands in Queued Calls panel |
| 5 | BB-03 | Master switch OFF actually stops calls |

If all 5 pass → system is healthy.

---

## Test Result Tracking Template

| Test ID | Date | Tester | Result | Notes |
|---|---|---|---|---|
| BB-01 | | | ☐ Pass ☐ Fail | |
| BB-02 | | | ☐ Pass ☐ Fail | |
| ... | | | | |