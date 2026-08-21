# 06 — During event and post-event

**Depends on:** [03](./03-task-timeline-and-roles.md), [05](./05-run-of-show-and-beo.md)  
**Primary code today:** [`postEventAutomation.ts`](../server/services/events/postEventAutomation.ts)

---

## Goal

Cover **day-of** responsibilities and **post-event** sales/ops loop: survey, media, thank-you emails, consumption, hours, and optional **new lead** for a future booking.

---

## During event

- Auto stage → `In Progress` on event date (job).  
- Event Lead tasks:
  - Stay in contact with day-of POC  
  - Track drink consumption (if applicable)  
  - Collect photo/video assets  
  - WhatsApp media upload (**manual task** linking to process; Twilio WhatsApp later)  
  - Team huddle: “What did we do well? What to improve?” → paste into Post Event Survey  
- Link: [Post Event Survey Form](https://docs.google.com/forms/d/17shTljWmlrpEvZBhljLFsu3oUQCeR_rQEGFjRr6LUJw/edit)

Remind in BEO check-in task: ETL should take ~5 minutes during cleanup to fill survey / upload — not later at home.

---

## Post-event (Admin + Sales)

### Admin (morning after)

- Pull media from lead / Drive folder  
- Prep assets for thank-you email  
- Staff hours / receipts pointers  
- Consumption invoice if needed  

### Sales — thank-you email (draft, not auto-send)

Two templates from cooking doc (adapt experience name dynamically):

1. **Version 1 — General** thank-you + optional photo link + feedback ask  
2. **Version 2 — Highly positive** + ask to be point of reference  

Reuse Gmail draft + digest notify pattern (same as survey/call drafts).

### Sales — Email 2 (after good feedback)

Checklist / follow-up task:

- When is their next event?  
- Intro to 3 people who would benefit?  
- Newsletter interest?  
- **Build out another lead in CRM?** Yes/No → if Yes, create Lead prefilled from event/client (Sales responsibility)

### Ops / Finance

- Event report: labor hours, venue fees, supplies  
- Invoice status fields already on `events`

---

## Acceptance checklist

- [ ] Day-of tasks appear for Event Host  
- [ ] Survey + Drive photo folder links on event  
- [ ] Thank-you drafts use cooking copy variants with correct experience name  
- [ ] “Create follow-up lead” path works  
- [ ] No client auto-send without draft review  

---

## Non-goals

- Automated WhatsApp via Meta (document as future)  
- Full payroll invoicing system
