# 01 — Event workflow foundation

**Depends on:** nothing  
**Unblocks:** 02–07  
**Primary code today:** [`events` schema](../server/db/schema/events.ts), [`generateWorkflow.ts`](../server/services/events/generateWorkflow.ts), [`tasks` schema](../server/db/schema/tasks.ts)

---

## Goal

Make the CRM able to store **experience-specific workflow templates** and instantiate them onto an Event as **structured tasks + config**, matching the In-Person Cooking doc structure (timeline buckets + owners).

---

## Why

`generateWorkflow.ts` already hardcodes thin task lists per event type. The cooking BEO doc is far richer (deposit intake fields, ROS checklist, inventory SKUs, post-event copy). We need a template model we can grow without rewriting TypeScript for every checkbox.

---

## Deliverables

### 1. Workflow template storage

Add (or extend) tables / JSON:

- **`event_workflow_templates`**
  - `experience_key` (e.g. `in_person_cooking`)
  - `display_name`
  - `version`
  - `is_active`
- **`event_workflow_task_defs`**
  - `template_id`
  - `phase`: `upon_deposit` | `ros` | `one_week_before` | `24h_before` | `during` | `post`
  - `title`
  - `description` (optional how-to)
  - `role`: Sales | Admin | Ops | Marketing | Event Host | Finance
  - `due_offset_days` (relative to `eventDate`; negative = before)
  - `due_anchor`: `event_date` | `deposit_date` | `immediate`
  - `sort_order`
  - `resource_links` jsonb (videos, Vendor Directory, forms)
  - `conditional` jsonb (e.g. only if `alcohol_included`, only if `custom_addons.aprons`)
  - `is_cooking_specific` boolean (for later multi-experience)

Seed **v1 from** [`Copy of _In-Person Cooking.md`](../BEO_System_docs/Copy%20of%20_In-Person%20Cooking.md).

### 2. Event config blob for intake answers

Extend `events` (columns and/or `event_config` jsonb) for cooking intake fields not already first-class:

Already on `events` (reuse): venue, alcoholIncluded, alcoholPreference, transportationNeeded, transportationDetails, customAddons, headcount, depositAmount, poc*, beoLink, fareharborLink, menu, inventoryStatus, loadingDockReserved, stage.

Add / nest:

- `headcount_min` / `headcount_max` (range)
- `event_start_time` (or ensure `eventDate` stores wall time in ET)
- `is_competition` boolean
- `dish_configuration` enum: `entree` | `app_entree` | `app_entree_dessert`
- `food_additions` jsonb
- `bar_details` jsonb (card / ticketed / fixed; wine/beer/soft; mixed top shelf/rail)
- `media_permission` enum (ok marketing | internal only | no photos)
- `seating_curated` + `seating_mode`
- `run_of_show` jsonb (answers from ROS meeting)
- `participation_list_url`, `post_event_survey_url`, `workflow_crm_url`
- `slack_alert_sent_at`

### 3. Event stages (pipeline for ops)

Align `eventStageEnum` with cooking lifecycle if gaps exist:

Suggested: `Deposit Received` → `Planning` → `Run Of Show Scheduled` → `Pre-Event Ready` → `In Progress` → `Post-Event` → `Completed` (keep Lost/Canceled).

Auto-advance “In Progress” when `now` crosses `eventDate` (job or on read).

### 4. Replace thin hardcoded cooking path

In `generateWorkflow` / `createEventFromWonLead`:

- Prefer DB template for Cooking Class / In-Person Cooking
- Keep hardcoded map as fallback for unmigrated types until plan 07

### 5. Admin UI (minimal)

- View active template + task defs (read-only first is OK)
- Ability to toggle task active / edit resource URLs later (plan 04)

---

## Non-goals

- Full BEO document generator
- Multi-experience parity (plan 07)
- Slack API integration (plan 03 can start with email blast)

---

## Acceptance checklist

- [ ] Cooking template seeded with phases matching the cooking doc
- [ ] Creating an event can attach `template_id` and generate tasks from defs
- [ ] Event can store competition / dish config / food additions / bar details
- [ ] Old short DEFAULT_CHECKLIST is not the only output for cooking

---

## Key files

- [`server/db/schema/events.ts`](../server/db/schema/events.ts)
- [`server/services/events/generateWorkflow.ts`](../server/services/events/generateWorkflow.ts)
- [`server/services/leads/createEventFromWonLead.ts`](../server/services/leads/createEventFromWonLead.ts)
- Source: [`BEO_System_docs/Copy of _In-Person Cooking.md`](../BEO_System_docs/Copy%20of%20_In-Person%20Cooking.md)
