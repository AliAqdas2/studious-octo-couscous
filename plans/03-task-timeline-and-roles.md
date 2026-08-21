# 03 — Task timeline and roles

**Depends on:** [01](./01-event-workflow-foundation.md), [02](./02-deposit-intake-and-crm-sync.md)  
**Unlocks:** day-to-day ops usage

---

## Goal

Turn template task defs into **dated, owned tasks** with queues per role and the **48-hour staff response** policy called out in the cooking doc.

---

## Timeline buckets (Cooking)

| Phase | When | Examples |
|-------|------|----------|
| Upon deposit | Immediate | Slack/email blast, FareHarbor item, BEO shell, staff outreach, loading dock |
| ~2.5 weeks before | `eventDate - 17d` | Email client, schedule ROS + calendar invite |
| Run of Show | At meeting | Confirm menu, bar, arrival, time change, HC, day-of POC, media permission, seating, add-ons |
| One week before | `eventDate - 7d` | Menus/QR (Marketing), inventory order (Ops), remaining shopping |
| Staff BEO check-in | 72–48h before | Phone chat host + instructor |
| 24h before | `eventDate - 1d` | Triple-check inventory, ice Y/N, staging |
| During | On `eventDate` | Photos, consumption, WhatsApp media, team debrief → survey |
| Post | `eventDate + 0–1d` | Admin media for morning email; Sales thank-you; hours/invoice; optional new lead |

Due dates = `eventDate` + `due_offset_days` (ET). If event date changes, **reschedule open tasks**.

---

## Role queues (UI)

- My Tasks (assigned user)  
- Role inbox: Admin / Ops / Sales / Marketing / Event Host  
- Event checklist view (all tasks for one event, grouped by phase)

Each task card shows: title, due date, role, resource links (how-to video, Vendor Directory, Form), complete checkbox, notes.

---

## Staff availability policy

Task: “Reach out to Instructor and Event Team Immediately”

- Sub-status: contacted | awaiting | confirmed | escalated  
- If no response in **48 hours**, escalate task to Ops Manager / Zach  
- Record which member reached out

---

## Notifications (v1)

Meeting preferred: email blast to Dave, Zach, Monica, Eileen on deposit (internal). Slack Salesalert can remain a **checklist link** until Slack API is wired.

Digest: overdue workflow tasks in daily digest (reuse `DIGEST_RECIPIENTS` / digest job).

---

## Acceptance checklist

- [ ] Tasks get correct due dates from event date
- [ ] Changing event date updates open task dues
- [ ] Role filters work
- [ ] 48h escalation path exists for staff outreach
- [ ] Resource links from cooking doc appear on relevant tasks

---

## Key files

- [`tasks` schema / task UI](../server/db/schema/)
- [`generateWorkflow.ts`](../server/services/events/generateWorkflow.ts)
- [`assignEventStaff.ts`](../server/services/events/assignEventStaff.ts)
- [`sendDailyDigest.ts`](../server/jobs/sendDailyDigest.ts)
