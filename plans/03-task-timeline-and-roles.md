# 03 — Task timeline and roles

**Depends on:** [01](./01-event-workflow-foundation.md), [02](./02-deposit-intake-and-crm-sync.md)  
**Traceability:** C030–C044, C057–C094  
**Meeting override:** Slack Sales Alert is **not** a required CRM step.

---

## Goal

Instantiate dated, owned tasks with role queues, full Marketing week-before sub-checklist, apron/supply tasks, and 48h staff policy.

---

## Family A timeline (Cooking)

| Phase | When | Key tasks |
|-------|------|-----------|
| `upon_deposit` | Immediate | Sales meeting; email blast; FH; Admin BEO + links; Ops shell; staff outreach; loading dock |
| `two_point_five_weeks` | eventDate − 17d | Email client; schedule ROS; calendar invite client+Sales |
| `ros` | At meeting | ROS form (plan 05) |
| `one_week_before` | eventDate − 7d | Marketing print/QR; Ops inventory order; Basecamp apron send |
| `staff_checkin_72_48h` | 72–48h before | Host+Instructor phone BEO check-in |
| (still ~1w window) | Before event | Company aprons **cleaned**; logo’d aprons **ready for Basecamp pickup**; remaining supplies method |
| `twenty_four_h` | eventDate − 1d | Triple-check inventory (**Ops Manager or Intern**); Ice Y/N |
| `during` / `post` | Plan 06 | |

If `eventDate` changes → reschedule open tasks.

---

## Deposit notify (C030 meeting override)

**Required:** email to **Dave, Zach, Monica, Eileen** with event summary + CRM link.  
**Not required:** posting to Slack Salesalert. Slack URL may appear as optional resource on the notify task.

---

## Marketing week-before (exact sub-checklist)

Owner: **Marketing Associate**

1. Recipe cards / menu printed ([How to Create Recipe Cards](https://drive.google.com/file/d/1nTWDc2MRYW0tseNMDLnAtnqGUr1zyMNU/view))  
2. **Menu verified by the chef for THIS function?**  
3. **Appropriate paper in stock?** (Ops note: what paper)  
4. **Printed in the office?** — FedEx how-to resource / Zach video note  
5. QR: created already? if not create → **on website?** → **printed?** ([QR folder](https://drive.google.com/drive/folders/1qDXF2mUG_lSHrHyrGOviqHTwbov3sOmo))  
6. **Menu tents**  
7. **Recipe cards**  
8. **Bar menu**

---

## Aprons & remaining supplies

- Reconfirm custom aprons **sent to Basecamp DC** ([Vendor Directory](../BEO_System_docs/Vendor%20Directory.md))  
- **Company aprons cleaned and ready** for this function  
- **Logo’d aprons ready for pickup from Basecamp DC**  
- Remaining supplies pickup method: **in-person | curbside | rush shipping**

---

## Staff availability (C038–C040)

- Contact Instructor + Event Team **immediately**  
- Sub-status: contacted | awaiting | confirmed | escalated  
- No response in **48h** → escalate to Ops Manager / Zach  
- Record which member reached out  

---

## Role UI

My Tasks | Role inbox (Admin/Ops/Sales/Marketing/Event Host) | Event checklist by phase.  
Each card: title, due, role, resources, complete, notes.

---

## Digest

Overdue workflow tasks in daily digest.

---

## Acceptance

- [x] No required Slack send step
- [x] Email blast to four named people
- [x] All Marketing sub-checks named (incl. bar menu, QR on website, chef verify)
- [x] Apron clean + Basecamp pickup tasks
- [x] Remaining supplies method enum
- [x] 24h assignee Ops Manager or Intern; ice Y/N; no invented staging-only requirement
- [x] `staff_checkin_72_48h` phase used
