# In-Person Mixology workflow — what changed

**Source:** `CopyofInPersonMixology.html` (Updated January 2024)

**CRM:** Family **C** (collapsed ~1 week) in `experienceWorkflowSeed.ts` / `experienceMatrix.ts`. Existing events keep old tasks until **Regenerate Event Workflow**.

## Summary

Promoted from **stub** (Zach flag + venue-only MX001) to a **complete** Mixology seed. Generic Family C inventory stub (**C067**) is omitted. Eventware checklist is seeded; **liquor SKUs are not invented** — spirits/mixers follow the confirmed cocktail menu + Inventory Links.

## Notable changes

- **Upon deposit:** Confirm venue / on-premise + loading dock (house list, not only 2001 K ST); capture cocktails selected (1 / 2 / 3).
- **1 week:** Order eventware supplies; custom aprons → Basecamp; chef verifies menu; paper/FedEx; recipe-card marketing; QR; logo’d + company aprons; triple-check + rush supplies.
- **During:** Track drink consumption (+ WhatsApp media); team debrief → Post Event Survey.
- **Post:** Consumption invoice (if alcohol); EVENT REPORT.
- **ROS label:** Confirm cocktails / menu.
- **`docQuality`:** complete (Zach stub flag removed).

## Removed for Mixology only

- Shared Family C stub **C067**.
- Narrow “2001 K ST only” venue wording as the sole Mixology delta.

## Production apply (after deploy / image rebuild)

No DB migration required. Templates upsert via seed (`dist/seed.js` already calls `seedEventWorkflows()`).

```bash
# Preferred on the app container
docker exec -it mangia_app node dist/seed.js
```

Alternative (host with `tsx` and prod `DATABASE_URL`):

```bash
npm run db:seed-event-workflows
```

Then, for live Mixology events that already have tasks: open Event Detail → **Regenerate Event Workflow**.
