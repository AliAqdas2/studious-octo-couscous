# 07 — Multi-experience templates

**Depends on:** Cooking path working end-to-end (01–06)  
**Sources:** All remaining files in [`BEO_System_docs/`](../BEO_System_docs/)

---

## Goal

Clone the **shared skeleton** from Cooking into templates for every other experience doc, changing only **inventory** and experience-specific confirm steps (Zach’s rule).

---

## Experiences to port

| Doc | Template key | Likely deltas vs Cooking |
|-----|--------------|--------------------------|
| Paint & Sip | `in_person_paint_sip` | Canvas 8x10 vs 11x14; easels; scissors; berets; confirm painting |
| Mixology | `in_person_mixology` | Cocktail inventory; confirm cocktails |
| Chocolate Making | `in_person_chocolate` | Chocolate-specific inventory |
| Chocolate & Wine | `in_person_chocolate_wine` | Wine + chocolate |
| Cheeseboard | `in_person_cheeseboard` | Board inventory |
| Gingerbread | `in_person_gingerbread` | Seasonal inventory |
| Terrarium | `in_person_terrarium` | Plant/soil inventory |
| Pottery | `in_person_pottery` | Clay / kiln notes |
| Lend a Hand for Good | `in_person_lend_a_hand` | Nonprofit-specific steps if any |
| Monuments Tour | `in_person_monuments` | Route; less kitchen inventory |
| Private Food Tour | `in_person_food_tour` | Restaurant stops |
| Flavors of DC | `flavors_of_dc` | Olive oil gift; venue preference; participant list early |

Shared blocks to reuse as template includes: deposit intake add-ons, alcohol, transport, venues, FH, BEO, staff 48h, ROS core, post-event emails.

---

## Process per experience

1. Diff doc vs Cooking  
2. Mark missing inventory → ask Zach to fill if absent (meeting instruction)  
3. Seed `event_workflow_templates` + task defs + catalog tags  
4. Map `lead.eventTypeInterest` / `EVENT_TYPE_MAPPING` in `createEventFromWonLead`  
5. Smoke-test: fake deposit → tasks + inventory  

---

## Acceptance checklist

- [ ] Every BEO_System_docs experience has an active template  
- [ ] Selecting event type instantiates the right template  
- [ ] Shared tasks are not copy-pasted inconsistently (shared def IDs or include mechanism)  
- [ ] Inventory differs correctly per type  

---

## Also note (not this plan)

Recruiting / tour guide / instructor / team lead **hiring** workflows → Onboarding System, not Event Ops.
