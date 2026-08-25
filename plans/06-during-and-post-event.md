# 06 — During and post-event

**Depends on:** [01](./01-event-workflow-foundation.md), [05](./05-run-of-show-and-beo.md)  
**Traceability:** C095–C118  
**Code today:** [`postEventAutomation.ts`](../server/services/events/postEventAutomation.ts) — extend, don’t replace.

---

## Goal

Day-of Host/Ops tasks with handbook links; post-event media, survey, thank-you V1/V2, EMAIL 2, LinkedIn, +3-month T-shirt, invoicing policy, optional new lead.

---

## During (day-of)

| Task | Owner | Resources / notes |
|------|-------|-------------------|
| Follow event-specific BEO (layout/inventory/client) | Event Host | BEO URL |
| Host handbook reminders | Event Host | [Company Handbook](https://docs.google.com/document/d/19OsGb5N7y_GIgUsYuSsfjTxVBx65Mn_zPH5_mH3grO0/edit) |
| Ops support handbook reminders | Ops | Same handbook |
| Stay in contact with day-of POC | Event Lead | |
| Ensure **guest speakers speak** | Event Lead | |
| Gather photo assets | Event Lead | |
| Upload assets to **digital database** + Drive photos folder | Event Lead | [Event Photos](https://drive.google.com/drive/folders/1un3gg73vMrmkbLR_8BaHqw1XLTtHrC1I) |
| Post-event survey | Event Lead | Form URL |
| Track drink consumption | Event Host | |
| WhatsApp media (manual) | Event Lead | Automation deferred |
| Team debrief → survey (“What did we do well / improve?”) | Event Lead | |

---

## Post-event Admin / Sales

**Admin (morning after):**

- Obtain media from event lead / digital database  
- Route into post-event email  
- Capture **staff hours of the event**  
- Capture **additional details on the event**  
- Consumption invoice path  

**Sales — Thank-you:**

- Templates V1 (general) / V2 (highly positive)  
- **Dynamic experience name** — never leave “paint and sip” hardcoded for cooking  
- Photo download link when applicable  

**After V2 yes:**

- Place feedback in **event tracker**  
- Send **LinkedIn** connection request  

**+3 months:**

- Request **T-shirt size**  
- CEO thank-you letter + offer **Mangia DC T-shirt**

**EMAIL 2 (good feedback) — full cooking lines:**

- WHEN IS THEIR NEXT EVENT they plan?  
- The kindest compliment we could receive is to introduce us to three individuals you think could benefit from our services?  
- Do you have interest in being in our newsletter?  
- Build another lead into Sales CRM — Yes/No  

---

## Invoicing / event report

- Event staff logs hours; **invoice at end of month**  
- Receipts: **EOM with invoice** **or** submit **immediately after event**  
- Event report: labor hours, venue fees, supplies purchased  

---

## Acceptance

- [x] Guest speakers + handbook links + digital database upload
- [x] Staff hours + additional details capture
- [x] V2 → tracker + LinkedIn; +3mo T-shirt path
- [x] Invoice timing policy as cooking
- [x] EMAIL 2 lines from cooking
- [x] Thank-you templates use dynamic experience name
- [x] Optional new lead path

**Also:** Event Ops feature toggles (WhatsApp **off by default**) on Event Detail — admin can enable when ready.

**Next:** execute [`07-multi-experience-templates.md`](./07-multi-experience-templates.md).
