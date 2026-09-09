# In-Person Lend a Hand for Good workflow — what changed

**Source:** `CopyofInPersonLendAhandforGoodEventWorkflow.html` (Updated January 2024)

**CRM:** Family **B** in `experienceWorkflowSeed.ts` / `experienceMatrix.ts`. Existing events keep old tasks until **Regenerate Event Workflow**.

## Summary

Uncoupled from the **Paint & Sip clone**. Lend a Hand now has its own deltas: venue/on-premise, 3-week project materials + eventware, add-on supplies, aprons, during/post. Generic Family B **1-week inventory order (B067)** is omitted (inventory at ~3 weeks per playbook).

## Notable changes

- **Upon deposit:** Confirm venue / on-premise + loading dock.
- **3 weeks:** Capture/order charity project materials (event-specific); order eventware (paper towels, paper plates, tablecloths, masking tape, trash bags, dinner napkins); plan nosh / warm meal / beverages / glassware / ice; custom aprons → Basecamp.
- **1 week:** Confirm add-on purchase sources; Basecamp apron pickup; triple-check + rush remaining supplies. Shared Host/Instructor check-in and company aprons (B090) remain.
- **During / post:** Drink consumption + WhatsApp; team debrief → survey; consumption invoice; EVENT REPORT.
- **ROS label:** Confirm Lend a Hand activity / menu.
- **`docQuality`:** complete (Zach incomplete flag removed; materials still event-specific by design).

## Removed

- Paint-clone tasks (canvas size, easels, paint inventory).
- Shared **B067** for this experience only.

## Production apply (after deploy / image rebuild)

No DB migration required. Templates upsert via seed (`dist/seed.js` already calls `seedEventWorkflows()`).

```bash
docker exec -it mangia_app node dist/seed.js
```

Alternative (host with `tsx` and prod `DATABASE_URL`):

```bash
npm run db:seed-event-workflows
```

Then, for live Lend a Hand events that already have tasks: Event Detail → **Regenerate Event Workflow**.
