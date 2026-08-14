# 12 — Onboarding Phase 1 (Recruitment spine)

Manager-only hire flow: pick **role / stream**, **hire type**, and **source**, track candidates on a kanban, advance stages through Dave approval → offer → onboarding → active.

## What shipped

| Piece | Detail |
|-------|--------|
| Tables | `candidates`, `onboarding_workflow_templates`, `onboarding_workflow_steps`, `candidate_steps` |
| Migration | [`drizzle/0006_onboarding_candidates.sql`](../drizzle/0006_onboarding_candidates.sql) (wired in `migrate-apply`) |
| Seed | `npm run db:seed-onboarding` (also runs from `db:seed` when tables exist) |
| API | `POST /api/onboarding/candidates`, `GET /api/onboarding/candidates/:id` + entity CRUD |
| UI | **Recruitment** kanban, **Hire sources** playbook tab, **Candidate Detail** checklist, New Candidate dialog |
| Nav | Admin → Recruitment |

## Hire sources catalog

On Recruitment, toggle **Pipeline** ↔ **Hire sources**. The catalog lists every candidate `source` with how-to steps, links, contacts, fair dates, sample ad copy (copy button), Jul–Spring timeline, TOUR 241/490 notes, and faculty contacts — from Raisa’s handbook. University email blast is marked **needs detail** (Dave). Static data in `client/src/components/onboarding/hireSourcesCatalog.js` (no DB). Labels match the create-candidate source enum.

## Roles

- **Event Support Associate** — full clickable checklist (Raisa handbook / Chart 2)
- **Event Team Lead / Culinary Instructor / Food Tour Guide** — selectable; onboarding panel **Coming soon**; shared pipeline stages still work

## Credentials

CRM logins are for employees **after hire**. Candidates never get accounts in this phase.

## Commands

```bash
npm run db:migrate-apply   # applies 0006 if needed
npm run db:seed-onboarding # ESA template + coming_soon stubs
```

Docker (after rebuild):

```bash
docker exec -it mangia_app node dist/migrate-apply.js
docker exec -it mangia_app node dist/seed-onboarding.js
# or rely on entrypoint seed which now includes onboarding templates
```
