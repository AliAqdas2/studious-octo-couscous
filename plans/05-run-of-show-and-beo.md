# 05 — Run of Show and BEO

**Depends on:** [02](./02-deposit-intake-and-crm-sync.md), [03](./03-task-timeline-and-roles.md)  
**Primary source:** Cooking doc ROS section + meeting (confirm menu, bar, arrival, media, seating)

---

## Goal

Support the **Run of Show meeting** as structured CRM fields, and track **BEO shell + distribution** without yet auto-generating the full BEO document.

---

## Run of Show

### Scheduling (~2.5 weeks before)

- Task: Ops emails client + schedules ROS  
- Create calendar invite: client + Sales (reuse Gmail calendar / draft invite pattern)  
- Store `run_of_show_at` on event  

### Meeting capture form (Ops)

| Question | Control |
|----------|---------|
| Confirm menu (app / entree / dessert) | Text fields or pickers driven by dish_configuration |
| Double-check bar: handling? consumption? wine/beer? | Booleans / enums |
| How arriving? | motorcoach / Uber / own / all |
| Event time changed? | Y/N + new time |
| Confirm headcount | Number |
| Day-of POC | Name, email, phone |
| Multimedia permission | 3-way enum (marketing OK / internal only / no photos) |
| Curate seating? | Y/N; if Y: random vs client groups |
| Food additions counts | Optional numbers (charcuterie, protein, etc.) |
| Custom add-ons progress | Logo to embroiderist? custom name on apron? |
| Transportation company | Confirm |

Persist on `events.run_of_show` jsonb + promote critical fields to columns (final headcount, poc, media_permission, eventDate/time if changed).

Talk track for photos (meeting): frame as “for you to use” to avoid marketing pushback — store as helper text on the media field.

---

## BEO (v1 = links + tasks, not generator)

Tasks:

1. Ops creates **BEO shell** (video how-to link) → paste `beoLink`  
2. Link BEO in FareHarbor private notes + CRM  
3. Immediately after ROS: email BEO to everyone working the event; embed in FH  
4. 72–48h: BEO staff check-in call (Host + Instructor)

Admin also creates on deposit: Participation list URL, Post-event survey URL, Workflow deep link to CRM event, Run of Show template link.

**Later (Zach session):** structured BEO builder from event + ROS data — track as follow-up, not this plan’s exit criteria.

---

## Acceptance checklist

- [ ] ROS scheduling task + calendar invite path  
- [ ] ROS form saves and updates event headcount / POC / media / time  
- [ ] `beoLink`, participation, survey, FH links stored on event  
- [ ] Task to email BEO to staff is completable with notes  

---

## Key files

- Event detail UI  
- Gmail draft / calendar helpers (existing)  
- [`events.beoLink` / `fareharborLink`](../server/db/schema/events.ts)
