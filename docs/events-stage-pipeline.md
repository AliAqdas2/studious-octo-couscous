# Events stage pipeline (CRM-01)

Leads-style stage visibility for events — **not** a drag-and-drop kanban.

## Stages (canonical)

`Deposit Received` → `Planning` → `Run Of Show Scheduled` → `Pre-Event Ready` → `In Progress` → `Post-Event` → `Completed` (+ `Lost` / `Canceled`)

Legacy DB values (e.g. `Event Day`, `Cancelled`) are normalized for display and filters.

## Events list

- Every card shows a **colored stage badge** (no need to open the record).
- Stage filter chips; Dashboard links `Events?stage=…` are honored.
- Default list hides Completed / Lost / Canceled unless you filter to them.

## Event detail

- **Stage strip** names the current stage and allows allowed transitions (admin/ops/sales).
- **Tasks → Current stage** (default): workflow tasks for that stage with **title, owner, due date, completed / not completed**.
- **All phases**: full checklist by workflow phase.

## Automations (unchanged + light hooks)

- Deposit complete → `Planning`
- ROS scheduled → `Run Of Show Scheduled`
- Event date reached → `In Progress`
- All pre-event workflow tasks Done → `Pre-Event Ready`
- Post-event save / first `post` task Done → `Post-Event`
- `Completed` still via existing completion paths (not forced by this pipeline)
