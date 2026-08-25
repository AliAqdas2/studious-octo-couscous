# 01 — Event workflow foundation

**Depends on:** nothing  
**Unblocks:** 02–07  
**Traceability:** [COOKING-TRACEABILITY.md](./COOKING-TRACEABILITY.md) (all C* IDs must be seedable)  
**Primary code today:** [`events` schema](../server/db/schema/events.ts), [`generateWorkflow.ts`](../server/services/events/generateWorkflow.ts), tasks schema

---

## Goal

Store **experience-specific workflow templates** and instantiate them as **structured tasks + config**, matching Cooking.md with **no `etc.` gaps**.

---

## Deliverables

### 1. Template tables

- **`event_workflow_templates`**: `experience_key`, `display_name`, `timeline_family` (`A`|`B`), `version`, `is_active`
- **`event_workflow_task_defs`**:
  - `phase`: `upon_deposit` | `two_point_five_weeks` | `ros` | `one_week_before` | `staff_checkin_72_48h` | `twenty_four_h` | `during` | `post`
  - `title`, `description`, `role`, `due_offset_days`, `due_anchor` (`event_date`|`deposit_date`|`immediate`)
  - `sort_order`, `resource_links` jsonb, `conditional` jsonb
  - `trace_id` optional string (e.g. `C038`) linking to COOKING-TRACEABILITY

**Seed v1:** every cooking checklist line → task def and/or intake field (see traceability).

### 2. Roles

`Sales` | `Admin` | `Ops` | `Marketing` | `Event Host`  
Intern = assignee option on `twenty_four_h` tasks (with Ops Manager).  
Do **not** invent Finance unless a cooking line requires it.

### 3. Admin BEO vs Ops BEO shell (cooking split)

| Who | What |
|-----|------|
| **Admin** | Creates **BEO** artifact on deposit (C035) plus participation, survey, CRM workflow link, ROS template |
| **Ops** | Creates **BEO Shell**, links to FareHarbor (C037); after ROS emails BEO to staff (C056) |

### 4. Required resource_links (seed constants)

Vendor Directory ([local](../BEO_System_docs/Vendor%20Directory.md) + Drive), FareHarbor how-to video, BEO shell video, Recipe Cards video, QR Drive folder, Inventory Links doc, Post Event Survey Form, Event Photos Drive, Company Handbook, Slack Salesalert (**optional resource only**), embroidery Wattz Web Design & Marketing + Minuteman Press, Sammy Transport / DC Nation Tours.

Full URLs: COOKING-TRACEABILITY “Named resources”.

### 5. Event config

Reuse existing event columns where possible; add/nest:

- `headcount_min` / `headcount_max`
- `is_competition`, `dish_configuration`
- `food_additions` jsonb (incl. shared FoDC/warm meal)
- `bar_details` jsonb
- `custom_addons` jsonb (amounts, 25-unit cheeseboard min, embroidered flags, logo_ordered)
- `venue_mode` (`go_to_them`|`house_venue`), `venue_restrictions`
- `media_permission`, seating fields
- `run_of_show` jsonb
- `participation_list_url`, `participation_list_type` (`sheets`|`forms`)
- `post_event_survey_url`, `workflow_crm_url`, `beo_url`, `beo_shell_url`
- `deposit_intake_completed_at`

### 6. Event stages

`Deposit Received` → `Planning` → `Run Of Show Scheduled` → `Pre-Event Ready` → `In Progress` → `Post-Event` → `Completed` (+ Lost/Canceled).  
Auto `In Progress` when now crosses `eventDate`.

### 7. Wire generation

`createEventFromWonLead` / `generateWorkflow`: Cooking → DB template; keep hardcoded fallback only for unmigrated types until plan 07.

---

## Acceptance

- [x] Phase enum includes all Family A phases above
- [x] Every COOKING-TRACEABILITY row has a seed target
- [x] Admin BEO and Ops BEO shell are distinct tasks
- [x] Resource URL list seeded (no missing named resources)
- [x] Short DEFAULT_CHECKLIST is not the only cooking output
