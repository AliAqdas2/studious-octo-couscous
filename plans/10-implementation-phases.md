# 10 — Implementation Phases

Recommended build order with milestones. Each phase is deployable.

## Phase 1 — Foundation (Week 1)

**Goal**: Authenticated CRUD API; frontend still on Base44 optional.

- [ ] `server/app/createApp.ts` — middleware stack
- [ ] Auth: login, JWT access + refresh, `auth.me` ([02](./02-auth-and-users.md))
- [ ] Entity CRUD for core tables: users, leads, clients, events, tasks ([01](./01-entity-crud-api.md))
- [ ] Serialize snake_case responses
- [ ] Seed script: admin user + default automation_config
- [ ] `GET /api/health` includes DB check

**Milestone**: Postman/curl can CRUD leads with JWT + refresh cookie.

## Phase 2 — Entity completeness (Week 2)

**Goal**: All entities available via REST.

- [ ] Remaining entity routes (templates, logs, spam, mappings, etc.)
- [ ] `bulkCreate` for leads, clients, events
- [ ] Lead search endpoint `getLeadsPaginated` ([05](./05-leads-pipeline.md))
- [ ] Indexes on leads table

**Milestone**: All `base44.entities.*` calls have REST equivalents.

## Phase 3 — Frontend cutover (CRUD) (Week 2–3)

**Goal**: UI reads/writes local Postgres for entity data.

- [ ] `apiClient.js` shim ([09](./09-frontend-cutover.md))
- [ ] Login page
- [ ] Switch entity calls (feature flag)
- [ ] Remove Base44 public settings check

**Milestone**: Dashboard, Leads, Events, Tasks work on local API.

## Phase 4 — Gmail (Week 3–4)

**Goal**: Email page fully functional.

- [ ] Gmail OAuth + token storage ([03](./03-gmail-email.md))
- [ ] sync, send, draft, reply, detail endpoints
- [ ] Template variable substitution
- [ ] `logLeadEmailActivity`
- [ ] Stage email automations on lead stage change

**Milestone**: Send email from Lead detail via Gmail.

## Phase 5 — Twilio calls (Week 4–5)

**Goal**: Automated calling works.

- [ ] Twilio webhooks + trigger call ([04](./04-twilio-calls.md))
- [ ] `onLeadCreated` job
- [ ] `analyzeCall` with OpenAI
- [ ] Retry scheduler
- [ ] Queued calls panel

**Milestone**: New lead triggers call; call log analyzed.

## Phase 6 — Inbound email & jobs (Week 5)

**Goal**: Contact form → lead pipeline automated.

- [ ] `pollGmailInbox` cron ([07](./07-webhooks-and-jobs.md))
- [ ] `handleContactFormEmail` / extract lead
- [ ] Spam detection → SpamEmail table
- [ ] `processed_gmail_messages` dedup

**Milestone**: Contact form email creates lead without manual entry.

## Phase 7 — Events & tasks advanced (Week 6)

**Goal**: Event workflows and task sync.

- [ ] `generateEventWorkflow` ([06](./06-events-tasks.md))
- [ ] `postSystemMessage`, thread messages, mentions
- [ ] `validateTaskSync` / `autoRepairTaskSync`
- [ ] `createEventFromWonLead`
- [ ] Client metrics sync

**Milestone**: Event detail generates tasks from template.

## Phase 8 — Integrations & imports (Week 6–7)

**Goal**: CSV import and file extract.

- [ ] File upload + extract ([08](./08-integrations.md))
- [ ] Lead/client/event import dialogs work
- [ ] FareHarbor webhook ([07](./07-webhooks-and-jobs.md))

**Milestone**: Import leads CSV end-to-end.

## Phase 9 — Polish & production (Week 7–8)

- [ ] Remove `@base44/sdk` entirely
- [ ] Error handling, logging, rate limits
- [ ] `sendDailyDigest` job
- [ ] `postEventAutomation`
- [ ] Docker / deploy docs
- [ ] E2E smoke tests

**Milestone**: Production deploy with no Base44 dependency.

## Risk register

| Risk | Mitigation |
|------|------------|
| Gmail OAuth complexity | Start with single admin mailbox; poller before push |
| Twilio Studio vs raw TwiML | Port exact TwiML from Base44 `triggerCallTwiML` |
| LLM prompt drift | Copy prompts verbatim from Base44 functions first |
| Frontend regression | Feature flag `VITE_USE_LOCAL_API`; test page by page |
| Scope creep | Stick to phase order; defer Calendar sync |

## Success criteria

The migration is complete when:

1. No requests go to `VITE_API_BASE_URL` (Base44)
2. All 24 pages function against local Express API
3. Gmail send/receive works
4. Automated calls fire on new leads
5. Data persists in Supabase Postgres
6. `npm run build && npm start` serves full CRM in production
