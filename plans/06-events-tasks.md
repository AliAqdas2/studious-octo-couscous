# 06 — Events & Tasks

Event lifecycle, task workflows, thread messages, and task sync validation.

## Frontend usage

| Area | Operations |
|------|------------|
| `Events.jsx` | List, delete (cascade tasks) |
| `EventDetail.jsx` | Tasks, acknowledge, generate workflow |
| `ConfirmedEvents.jsx` | Bulk import events via CSV |
| `EventFormDialog.jsx` | Create/update |
| `EventTemplates.jsx` | Template CRUD |
| `Tasks.jsx` | List, acknowledge, complete, override |
| `TaskSyncAdmin.jsx` | validateTaskSync, autoRepairTaskSync |
| `ThreadView.jsx` | ThreadMessage CRUD, @mentions |
| `NotificationBell.jsx` | Mentions, MentionRead |

## `generateEventWorkflow`

**Route**: `POST /api/events/:id/generate-workflow`

Port from Base44 `generateEventWorkflow/entry.ts`:

1. Load event + `event_templates` by `template_id` or `event_type`
2. Create `tasks` from `pre_event_tasks`, `event_day_tasks`, `post_event_tasks`
3. Calculate `due_date` from `event_date` ± `days_before_event` / `days_after_event`
4. Set `responsible_role`, `order`, `category`
5. `postSystemMessage` — "tasks_generated" on event thread
6. Return created task count

## Task operations

### Acknowledge / complete / override

Frontend updates `tasks` via entity PATCH + calls `postSystemMessage`:

```js
postSystemMessage({ task_id, event_id, system_action: 'acknowledged', ... })
```

**Route**: `POST /api/tasks/:id/system-message` or include in PATCH hook.

`postSystemMessage` creates `thread_messages` row with `is_system_message: true`.

### Role-based access

`Tasks.jsx` checks:
- Admin can override any task
- Non-admin only tasks matching their `role_assignments.role`

Enforce in `PATCH /api/tasks/:id` middleware.

## `validateTaskSync` / `autoRepairTaskSync`

Used by `TaskSyncDashboard.jsx` (admin).

### validateTaskSync

Compare expected tasks (from event template + event date) vs actual tasks on each active event.

Return:

```json
{
  "events": [
    {
      "event_id": "...",
      "event_name": "...",
      "missing_tasks": [...],
      "orphan_tasks": [...],
      "due_date_mismatches": [...]
    }
  ]
}
```

### autoRepairTaskSync

Input: `{ eventId }`

- Add missing tasks from template
- Remove orphan tasks (optional, confirm flag)
- Fix due dates

## Thread messages & mentions

### Create message

`POST /api/thread-messages`

- Parse `@mentions` from body → `mentioned_users` array of user IDs
- Set `author_id`, `author_name` from session
- Link `task_id` and/or `event_id`

### Mention reads

`NotificationBell` creates `mention_reads` when user views mention.

`GET /api/mentions/unread` — optional convenience endpoint.

## Event delete cascade

`Events.jsx` deletes all tasks then event.

Implement in DELETE hook: `cleanupEventTasks` — delete tasks where `event_id = ?`, then delete event.

## `assignEventStaff`

Background/admin: assign `instructor_assigned`, `ops_support_assigned`, `staff_assigned` from roles.

## `postEventAutomation`

Cron after event date: send follow-up email, request referral, LinkedIn connection flags.

Updates `events.followup_email_sent`, etc.

## `syncClientMetrics`

On event completed/cancelled:

- Update `clients.total_events`, `lifetime_revenue`, `average_event_value`
- Set `is_returning`, `first_event_date`, `last_event_date`

## `handleDepositReceived`

Webhook or manual: set `events.deposit_received`, advance stage.

## Files to create

```
server/services/events/generateWorkflow.ts
server/services/events/cleanupTasks.ts
server/services/events/postEventAutomation.ts
server/services/events/syncClientMetrics.ts
server/services/tasks/taskSync.ts
server/services/tasks/postSystemMessage.ts
server/services/threads/mentions.ts
server/routes/events.ts
server/routes/tasks.ts
```

## Verification

- [ ] Generate workflow creates correct tasks from template
- [ ] Task acknowledge writes system message
- [ ] Admin override recorded with `overridden_by`
- [ ] Task sync validation finds mismatches
- [ ] Auto-repair adds missing tasks
- [ ] @mentions appear in NotificationBell
- [ ] Event delete removes tasks
