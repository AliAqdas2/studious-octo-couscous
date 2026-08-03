# Mangia CRM — Express API Migration Plans

Replace the Base44 backend (`@base44/sdk` + serverless functions) with a self-hosted **Express + PostgreSQL (Drizzle)** API while keeping the existing React frontend.

## Current state

| Layer | Status |
|-------|--------|
| Frontend | Migrated from Base44 Version; still calls `@base44/sdk` |
| Database | Drizzle schema + migrations for 19 tables (`server/db/schema/`) |
| Express | `/api/health` only; serves Vite SPA |
| External deps | Frontend points at `VITE_API_BASE_URL` (Base44) |

## Target state

```
Browser → Express (port 5000)
            ├─ /api/auth/*          Session/JWT
            ├─ /api/entities/*      CRUD (Base44-compatible shape)
            ├─ /api/functions/*     Business logic (ex-Base44 functions)
            ├─ /api/gmail/*         Gmail read/send/draft
            ├─ /webhook/*           Twilio, FareHarbor, Gmail push
            └─ /*                   Vite / static SPA
```

## Plan index

| # | Plan | Scope |
|---|------|--------|
| [00](./00-architecture.md) | Architecture | Folder structure, API conventions, Base44 compatibility |
| [01](./01-entity-crud-api.md) | Entity CRUD | All 18 entities + users; list/filter/get/create/update/delete/bulk |
| [02](./02-auth-and-users.md) | Auth & users | Login, sessions, `auth.me`, user invite, role assignments |
| [03](./03-gmail-email.md) | Gmail & email | OAuth, sync, send, draft, reply, inbox, stage automations |
| [04](./04-twilio-calls.md) | Twilio calls | Automated calling, TwiML, call logs, analysis |
| [05](./05-leads-pipeline.md) | Leads pipeline | Pagination, stage machine, lead-created automations |
| [06](./06-events-tasks.md) | Events & tasks | Workflows, task sync, threads, mentions |
| [07](./07-webhooks-and-jobs.md) | Webhooks & jobs | Gmail poll, FareHarbor, scheduled retries, digests |
| [08](./08-integrations.md) | Integrations | File upload, AI extract, Google Calendar |
| [09](./09-frontend-cutover.md) | Frontend cutover | Replace `base44Client` with local API client |
| [10](./10-implementation-phases.md) | Phases | Priority order and milestones |

## Base44 surface area to replace

### Entities (18 + User)

`Lead`, `Client`, `Event`, `Task`, `RoleAssignment`, `ActivityLog`, `CallLog`, `EmailTemplate`, `EventTemplate`, `ThreadMessage`, `MentionRead`, `AutomationConfig`, `GmailPollState`, `SpamEmail`, `StageEmailMapping`, `ProcessedGmailMessage`, `FareharborEvent`, `TwilioWebhookLog`, `User`

### Functions invoked from frontend (22)

`getLeadsPaginated`, `createEventFromWonLead`, `generateEventWorkflow`, `triggerCallTwiML`, `analyzeCall`, `postSystemMessage`, `syncGmailEmails`, `createGmailDraft`, `sendGmailEmail`, `getEmailDetail`, `getDraftDetail`, `replyToEmail`, `logLeadEmailActivity`, `validateTaskSync`, `autoRepairTaskSync`

### Background / webhook functions (not directly invoked by UI)

`onLeadCreated`, `pollGmailInbox`, `handleContactFormEmail`, `extractLeadFromEmail`, `sendStageEmail`, `processScheduledCallRetries`, `noAnswer`, `handleMeetingConfirmationReply`, `handleDepositReceived`, `fareharborWebhook`, `twilioBusinessProfileCallback`, `twimlCallbacks`, `sendSurveyEmailOnNoAnswer`, `postEventAutomation`, `sendDailyDigest`, `autoDetectLeadType`, `detectReturningClient`, `linkEventToClient`, `syncClientMetrics`, `assignEventStaff`, `cleanupEventTasks`, `validateLeadStageTransition`, `getInboxEmails`, `getSentEmails`

### Integrations

- **Gmail** — primary email (OAuth, read/send/compose scopes)
- **Google Calendar** — calendar link / booking (connector exists in Base44)
- **File upload + AI extract** — CSV import (clients, leads, events)
- **Twilio** — voice automation

## Conventions

- **Response shape**: Match Base44 entity records: `{ id, created_date, updated_date, created_by, ...fields }` (snake_case)
- **Auth**: Bearer token or session cookie; middleware on all `/api/*` except public auth routes and webhooks
- **Errors**: `{ error: string, details?: unknown }` with appropriate HTTP status
- **IDs**: UUID (already in Drizzle schema)

## Environment variables (additions)

See individual plans. Core additions:

```env
DATABASE_URL=...
SESSION_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
GMAIL_SENDER_EMAIL=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
OPENAI_API_KEY=...          # call analysis, lead extract, spam detect
```

## Out of scope (initial pass)

- Multi-tenant / org isolation
- Full Google Calendar sync UI
- Mobile app API versioning
