# 02 — Deposit intake and CRM sync

**Depends on:** [01](./01-event-workflow-foundation.md)  
**Unblocks:** [03](./03-task-timeline-and-roles.md)  
**Primary code today:** [`createEventFromWonLead.ts`](../server/services/leads/createEventFromWonLead.ts), lead fields, Event detail UI

---

## Goal

When a sale is confirmed / deposit received, **prefill** the event from the lead and force a structured **Deposit Intake** so Sales captures everything ops needs (without retyping into Slack as the source of truth).

---

## Prefill from lead → event (meeting “sync” list)

| Field | Source |
|-------|--------|
| Company name | `lead.company` |
| Contact name / email / phone | `lead.name`, `lead.email`, `lead.phone` |
| Preferred experience | `lead.eventTypeInterest` → `event.eventType` |
| Date | `lead.preferredDate` / meeting / confirmed event date |
| Start time | Lead or deposit form (must be editable; store on event) |
| Estimated headcount | `lead.headcountEstimate` → min/max range on form |
| Venue | Lead notes / form |
| Deposit amount / number | Lead deposit fields → **restricted** visibility |
| Event planner POC | Lead or form (name, email, phone) |

Anything overlapping CRM → workflow must **not** be re-highlighted as manual entry.

---

## Deposit Intake UI (Sales)

Single form / Event section “Upon Deposit”, dropdown-heavy:

1. Alcohol Y/N → if Y: Card on file | Ticketed | Fixed open bar; sub: wine/beer/soft, mixed drinks top shelf/rail  
2. Competition vs Cooking experience  
3. Dish configuration: Entree | App+Entree | App+Entree+Dessert (menu selected later at ROS)  
4. Food additions (optional numeric/boolean fields)  
5. Custom add-ons (shared across experiences)  
6. Transportation Y/N + company (Alberto / DC Nation / Other)  
7. Venue select from known list + “Other” + restrictions text  
8. Headcount range (min–max, up to 3 digits each)  
9. Deposit amount (role-gated: Sales/Ops managers only)

Venue list from cooking doc (Launch Glover Park, Mr. Smith’s, City Tavern, Whittemore House, Wharf Penthouse, Wingos, 99 M St SE, The Foundry, 1015 15th St NW) + Other.

---

## Trigger workflow

On intake save (or on Confirmed Sales if intake already complete):

1. Ensure Event exists (`createEventFromWonLead`)  
2. Persist intake → event columns / `event_config`  
3. Call template instantiation (plan 01) → create tasks  
4. Mark `deposit_intake_completed_at`  
5. Enqueue team notify (plan 03)

---

## Permissions

- Deposit amount: visible/editable only to users Dave named (Monica, Zach, Dave) — implement via role flag or allowlist, not “all staff.”
- Marketing can open event but not see financial fields.

---

## Acceptance checklist

- [ ] Lead → Event copies company, contact, experience, date/time, headcount, deposit
- [ ] Intake form validates required ops fields before marking complete
- [ ] Completing intake generates cooking workflow tasks
- [ ] Deposit amount hidden from non-privileged roles
- [ ] Slack is no longer required to “know” the basics (alert may still fire)

---

## Key files

- Client Event / Lead deposit UI (existing Event detail pages)
- [`createEventFromWonLead.ts`](../server/services/leads/createEventFromWonLead.ts)
- Lead + Event schemas
