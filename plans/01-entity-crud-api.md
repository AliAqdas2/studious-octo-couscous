# 01 — Entity CRUD API

Generic REST CRUD for all Drizzle tables, matching Base44 entity behavior the frontend expects.

## Entities and routes

| Entity | Route prefix | Table |
|--------|--------------|-------|
| User | `/api/users` | `users` |
| Lead | `/api/leads` | `leads` |
| Client | `/api/clients` | `clients` |
| Event | `/api/events` | `events` |
| Task | `/api/tasks` | `tasks` |
| RoleAssignment | `/api/role-assignments` | `role_assignments` |
| ActivityLog | `/api/activity-logs` | `activity_logs` |
| CallLog | `/api/call-logs` | `call_logs` |
| EmailTemplate | `/api/email-templates` | `email_templates` |
| EventTemplate | `/api/event-templates` | `event_templates` |
| ThreadMessage | `/api/thread-messages` | `thread_messages` |
| MentionRead | `/api/mention-reads` | `mention_reads` |
| AutomationConfig | `/api/automation-config` | `automation_config` |
| GmailPollState | `/api/gmail-poll-state` | `gmail_poll_state` |
| SpamEmail | `/api/spam-emails` | `spam_emails` |
| StageEmailMapping | `/api/stage-email-mappings` | `stage_email_mappings` |
| ProcessedGmailMessage | `/api/processed-gmail-messages` | `processed_gmail_messages` |
| FareharborEvent | `/api/fareharbor-events` | `fareharbor_events` |
| TwilioWebhookLog | `/api/twilio-webhook-logs` | `twilio_webhook_logs` |

## Standard endpoints (per entity)

```
GET    /api/{entity}              List (with query params)
GET    /api/{entity}/:id          Get by id
POST   /api/{entity}              Create
PATCH  /api/{entity}/:id          Update (partial)
DELETE /api/{entity}/:id          Delete
POST   /api/{entity}/bulk         Bulk create (where frontend uses bulkCreate)
```

## Query parameters (list / filter)

Base44 SDK patterns to support:

| SDK call | REST equivalent |
|----------|-----------------|
| `Lead.list('-created_date', 500)` | `GET /api/leads?sort=-created_date&limit=500` |
| `Lead.filter({ email: 'x' }, '-created_date', 1)` | `GET /api/leads?filter[email]=x&sort=-created_date&limit=1` |
| `Task.filter({ event_id: id })` | `GET /api/tasks?filter[event_id]=:id` |
| `AutomationConfig.filter({ key: 'default' })` | `GET /api/automation-config?filter[key]=default` |

### Query spec

- `sort` — field name, prefix `-` for DESC (e.g. `-created_date`, `-timestamp`)
- `limit` — max rows (default 100, max 5000)
- `offset` — pagination offset
- `filter[field]` — equality filter; support multiple values as comma-separated
- `filter[field][gte]`, `[lte]` — date range (for leads list page)

## Response shape

Single record:

```json
{
  "id": "uuid",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "stage": "New Inquiry",
  "created_date": "2026-01-15T10:00:00.000Z",
  "updated_date": "2026-01-15T10:00:00.000Z",
  "created_by": "uuid-or-null"
}
```

List:

```json
{
  "data": [ /* records */ ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

For simpler frontend migration, also support raw array response via `?format=array` during transition.

## Implementation

### `server/services/entities/entityService.ts`

Generic service factory:

```ts
function createEntityService(table, options?: {
  searchableFields?: string[];
  defaultSort?: string;
  hooks?: {
    beforeCreate?: (data, user) => data;
    afterCreate?: (record, user) => void;
  };
})
```

### `server/routes/entities/` 

Option A — one router per entity (verbose but clear):
- `leads.routes.ts`, `clients.routes.ts`, …

Option B — registry pattern (recommended):

```ts
// registry.ts
export const entityRegistry = {
  leads: { table: leads, searchable: ['name', 'email', 'company'] },
  clients: { table: clients, searchable: ['name', 'email'] },
  // ...
};
```

Single `entitiesRouter` reads `:entityName` or mount each at its prefix.

### Field mapping

- **Input**: accept snake_case from frontend (match Base44)
- **DB**: Drizzle camelCase columns
- **Output**: snake_case JSON

### `created_by`

Set from `req.user.id` on create; allow admin override.

## Entity-specific rules

### Lead

- Required: `name`, `email`
- On create: trigger `onLeadCreated` job (see [05-leads-pipeline.md](./05-leads-pipeline.md))
- On stage change: validate transition (`validateLeadStageTransition`), log activity, optionally `sendStageEmail`

### Event

- On create from won lead: handled by function, not raw CRUD
- On delete: cascade delete tasks (`cleanupEventTasks`)

### Task

- `event_id` required
- Status transitions log `ActivityLog` + optional `postSystemMessage`

### User

- Admin-only list/delete
- No password in API responses
- See [02-auth-and-users.md](./02-auth-and-users.md)

### AutomationConfig / GmailPollState

- Singleton: `key = 'default'`; upsert pattern on create

### ProcessedGmailMessage

- `gmail_message_id` unique; create is idempotent (ignore duplicate)

## Permissions (initial)

| Role | Access |
|------|--------|
| `admin` | Full CRUD all entities |
| `user` with active `role_assignment` | CRUD except User admin ops |
| Unauthenticated | None |

Refine per-entity later (e.g. Sales only sees assigned leads).

## Auth for entity routes

- [`server/middleware/auth.ts`](../server/middleware/auth.ts) validates **Bearer JWT** (access token), not a session cookie
- `req.user` is populated from JWT claims; optionally re-check `users.is_active` in DB
- Entity CRUD logic is unchanged by the JWT vs session choice

## Files to create

```
server/services/entities/entityService.ts
server/services/entities/registry.ts
server/services/entities/serialize.ts
server/routes/entities/index.ts
server/routes/entities/leads.routes.ts   (if entity-specific hooks)
server/middleware/auth.ts
```

## Verification

- [ ] Every `base44.entities.*` call in frontend has a matching REST endpoint
- [ ] List/filter/sort match Base44 behavior for Leads page
- [ ] `bulkCreate` works for Client import and Lead import
- [ ] UUIDs returned on create
- [ ] `created_date` / `updated_date` auto-set
