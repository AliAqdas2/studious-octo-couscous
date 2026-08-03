# 05 — Leads Pipeline

Lead-specific business logic beyond generic CRUD: pagination, stage machine, automations.

## Frontend entry points

| Location | API |
|----------|-----|
| `Leads.jsx` | `getLeadsPaginated`, `triggerCallTwiML`, stage update |
| `LeadDetail.jsx` | CRUD, stage change, createEventFromWonLead, logLeadEmailActivity |
| `LeadStateMachine.jsx` | Stage transitions with validation |
| `LeadFormDialog.jsx` | Create/update, activity log |
| `ImportLeadsDialog.jsx` | bulkCreate leads + activity logs |
| `CalendarView.jsx` | Lead list, meeting_date updates |

## `getLeadsPaginated`

**Route**: `POST /api/leads/search` or `POST /api/functions/get-leads-paginated`

Port logic from [`Base44 Version/base44/functions/getLeadsPaginated/entry.ts`](../../Base44%20Version/base44/functions/getLeadsPaginated/entry.ts):

### Request body

```json
{
  "pageNumber": 1,
  "pageSize": 50,
  "searchQuery": "",
  "sortKey": "created_date",
  "sortDir": "desc",
  "filterStages": [],
  "filterChannel": "all",
  "filterSource": "all",
  "filterEventType": "all",
  "filterAccount": "",
  "dateInquiryFrom": "",
  "dateInquiryTo": "",
  "dateInterestFrom": "",
  "dateInterestTo": ""
}
```

### Response

```json
{
  "leads": [ /* records */ ],
  "totalCount": 1234,
  "pageNumber": 1,
  "pageSize": 50,
  "totalPages": 25
}
```

### Implementation

Use Drizzle query builder with dynamic `where` clauses instead of in-memory filter (Base44 loaded 5000 rows). Add indexes:

```sql
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_channel ON leads(channel);
CREATE INDEX idx_leads_created_date ON leads(created_date DESC);
CREATE INDEX idx_leads_email ON leads(email);
```

Unified stage sort order — port `UNIFIED_STAGE_ORDER` array from Base44 function.

## Stage transitions

### `validateLeadStageTransition`

Call before PATCH when `stage` changes.

Port rules from Base44 function — block invalid jumps, require fields for certain stages (e.g. lost reason).

### On stage change hooks

1. `ActivityLog.create` — "Stage Changed"
2. `sendStageEmail` if mapping exists (see [03-gmail-email.md](./03-gmail-email.md))
3. Update related event if `converted_to_event_id` set

## `onLeadCreated` automation

Trigger: after `POST /api/leads` (unless `skip_auto_call: true`).

Steps (port from Base44):

1. Skip if `ai_flag_category` set
2. Skip if ongoing gmail thread / returning client signals
3. Skip if `automation_config.enabled` is false
4. Invoke `triggerCall` (see [04-twilio-calls.md](./04-twilio-calls.md))

Implement as async job (don't block HTTP response).

## `createEventFromWonLead`

**Route**: `POST /api/leads/:id/create-event`

Input: `{ venue, ... }` from LeadDetail.

Steps:

1. Validate lead stage is Won (or equivalent)
2. Create `events` row from lead data
3. Link `lead.converted_to_event_id`, `lead.linked_event_id`
4. Set `lead.event_created: true`
5. `detectReturningClient` / link client
6. `ActivityLog` entry
7. Optionally `generateEventWorkflow`

## `detectReturningClient` / `linkEventToClient`

- Match lead email to `clients.email`
- Set `lead.client_id`, `is_returning_client`
- Populate `returning_client_summary` from client metrics
- `syncClientMetrics` on event completion

## `autoDetectLeadType`

On create/import: infer `channel` (B2B/B2C), `inquiry_type` from email content or company field.

## Lead import

`ImportLeadsDialog` uses file upload + AI extract (see [08-integrations.md](./08-integrations.md)) then `bulkCreate`.

Bulk endpoint must:

- Validate required fields
- Run `onLeadCreated` per row (or batch with flags)
- Create activity logs in same transaction batch

## Spam → Lead promotion

`SpamEmails.jsx` can convert spam to lead or merge with existing — uses standard Lead CRUD + SpamEmail delete.

## Files to create

```
server/services/leads/leadSearch.ts
server/services/leads/stageMachine.ts
server/services/leads/onLeadCreated.ts
server/services/leads/createEventFromWonLead.ts
server/services/leads/detectReturningClient.ts
server/routes/leads.ts              (search + create-event endpoints)
```

## Verification

- [ ] Leads page pagination/filters match Base44 behavior
- [ ] Stage machine blocks invalid transitions
- [ ] New lead triggers auto-call (when configured)
- [ ] Won lead → event creation works
- [ ] CSV import creates leads + activity logs
