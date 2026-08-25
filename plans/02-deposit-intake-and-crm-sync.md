# 02 — Deposit intake and CRM sync

**Depends on:** [01](./01-event-workflow-foundation.md)  
**Traceability:** C001–C029, C032  
**Conflict rule:** Deposit viewers = **Dave, Zach, Monica only**; FoDC/warm meal = **shared** add-on.

---

## Goal

On Confirmed Sales / deposit: **prefill** event from lead and complete structured **Deposit Intake** so Sales captures everything ops needs without Slack as system of record.

---

## Prefill (lead → event)

| Field | Source |
|-------|--------|
| Company | `lead.company` |
| Contact name / email / phone | lead |
| Preferred experience | `eventTypeInterest` → `eventType` |
| Date | preferred / confirmed |
| Start time | lead or form (editable on event) |
| Headcount | estimate → min/max range |
| Venue | notes / form |
| Deposit amount / number | lead → **restricted** |
| Event planner POC | lead or form |

---

## First task on deposit

**C001 — Meeting with sales** to determine location, date, timing, preferences (Sales). Completing meeting feeds / confirms intake.

---

## Deposit Intake form (Sales)

Dropdown-heavy; **Other** on each category where listed.

1. **Alcohol** Y/N → if Y: Card on file | Ticketed | Fixed open bar → Wine/Beer/Soft; Mixed Top Shelf | Rail  
2. **Competition vs Cooking**  
3. **Dish configuration:** Entree | App+Entree | App+Entree+Dessert (menu at ROS)  
4. **Food additions** (optional amounts):
   - Charcuterie **boards** vs **platters** (distinct)
   - Additional protein on side
   - Mystery ingredients / alt sauces (**cooking-only**)
   - **Flavors of DC / Warm Meal** (**shared** across experiences)
5. **Custom add-ons** (shared; optional amount fields; not required to proceed):
   - Embroidered aprons + custom name Y/N + **logo ordered?**
   - Engraved glassware
   - Cheeseboard (**25 unit minimum** if selected)
   - Chocolate mold
   - Chef hats ± embroidered
   - Berets ± embroidered
6. **Transportation** Y/N → **Sammy Transport** | **DC Nation Tours** | Other (+ [Vendor Directory](../BEO_System_docs/Vendor%20Directory.md); Alberto = Sammy contact)  
7. **Venue**
   - Mode: **go to them** vs **house venue**
   - House list: Launch Glover Park, Mr. Smith’s, City Tavern, Whittemore House, Wharf Penthouse, Wingos, 99 M St SE, The Foundry, 1015 15th St NW, **Other**
   - Restrictions text
8. **Headcount** min–max (up to 3 digits each)  
9. **Deposit amount** — visible/editable only to **Dave, Zach, Monica**

Admin artifact fields on same flow (or Admin queue): participation URL + type **Sheets | Forms**.

---

## Trigger

On intake complete:

1. Ensure Event exists  
2. Persist intake  
3. Instantiate cooking template tasks  
4. Set `deposit_intake_completed_at`  
5. Enqueue **email blast** (plan 03) — not Slack send

---

## Acceptance

- [x] Prefill covers sync list; no double entry for overlapping CRM fields
- [x] C001 sales meeting task exists
- [x] Boards vs platters, 25-unit cheeseboard, FoDC shared, venue mode dichotomy
- [x] Participation type Sheets|Forms
- [x] Deposit amount gated to Dave/Zach/Monica
- [x] Completing intake generates Family A cooking tasks
