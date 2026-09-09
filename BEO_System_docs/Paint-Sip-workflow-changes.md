# In-Person Paint & Sip workflow — what changed

**Source:** `CopyofInPersonPaintSipEventWorkflow.html` (Updated January 2024)

**CRM:** Family **B** in `experienceWorkflowSeed.ts` / `experienceMatrix.ts`. Existing events keep old tasks until **Regenerate Event Workflow**.

## Summary

Expanded from the thin canvas/easel seed to the full Paint & Sip playbook: venue/on-premise, 3-week paint inventory + eventware + add-ons + Basecamp aprons, 1-week checks, during/post. Generic Family B **1-week inventory order (B067)** is omitted (inventory at ~3 weeks per playbook).

**Pottery** stays on the frozen thin Paint-clone (`potteryPaintCloneDeltas`) and does **not** inherit this expansion.

## Notable changes

- **Upon deposit:** Confirm venue / on-premise + loading dock; out-of-town → 8x10 + bubble vs 11x14; BEO Shell scissors + large easels.
- **3 weeks:** Order canvases / easels / brushes (Michaels, 5 Below, JMARK; Jude pickup if needed); eventware (cups, plates, tablecloths, tape, trash bags, napkins, bubble wrap if OOT); plan nosh / warm meal / beverages / ice; custom aprons → Basecamp.
- **1 week:** Confirm add-on purchase sources; Basecamp apron pickup; triple-check + rush remaining. Shared Host/Instructor check-in and company aprons (B090) remain.
- **During / post:** Drink consumption + WhatsApp; team debrief → survey; consumption invoice; EVENT REPORT.
- **ROS label:** Confirm art piece / menu.
- **`docQuality`:** complete.

## Removed for Paint & Sip only

- Shared **B067**.

## Production apply (after deploy / image rebuild)

No DB migration required. Templates upsert via seed (`dist/seed.js` already calls `seedEventWorkflows()`).

```bash
docker exec -it mangia_app node dist/seed.js
```

Alternative (host with `tsx` and prod `DATABASE_URL`):

```bash
npm run db:seed-event-workflows
```

Then, for live Paint & Sip events that already have tasks: Event Detail → **Regenerate Event Workflow**.
