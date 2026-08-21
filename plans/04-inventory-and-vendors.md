# 04 — Inventory and vendors

**Depends on:** [01](./01-event-workflow-foundation.md), [03](./03-task-timeline-and-roles.md)  
**Primary sources:** Cooking inventory section; Vendor Directory Google Doc; Inventory Links doc

---

## Goal

Give Ops a **per-event inventory checklist** with preferred purchase links, and a path to keep vendor / buy-URLs **user-updatable** (Dave: ops should be able to change “where we buy dish soap” without a code deploy).

---

## Inventory model

- **`inventory_catalog_items`**: name, category, default_url, notes, experience_tags (`cooking`, `paint_sip`, …), sort_order  
- **`event_inventory_checks`**: event_id, catalog_item_id, status (`needed` | `ordered` | `in_office` | `na`), quantity, notes, checked_by, checked_at  

On workflow generate for Cooking, seed checks from cooking list (paper towels, dish soap, plates, tablecloth, trash bags, napkins, spices, Sterno, aluminum trays, parchment, to-go containers, gloves, butane, olive oil, balsamic, salt/pepper, foil, glassware, aprons, etc.).

Week-before + 24h-before tasks link to the event inventory panel.

---

## Vendors

v1: store deep links to existing Google Docs:

- [Vendor Directory](https://docs.google.com/document/d/1HHU1nfh-3a0UdJVzgWqRqUFxBpfeC3Y_GQT-2Serbv4/edit)  
- [Inventory Links](https://docs.google.com/document/d/1WSsg6tgUGXv3bYspElOWjQvYFJnnVLXXLQI2gd0oh8U/edit)

v1.5 (same plan if time): `vendors` table (name, category venue|transport|embroidery|supply, contact, url, address) seeded with venues + Wattz Design / Minuteman Press / Alberto / DC Nation from meeting.

Embroidery / apron tasks reference Vendor Directory; custom apron “sent to Basecamp” checkbox.

---

## UX

- Event → Inventory tab: checklist with open-link buttons  
- Ops can edit URL on a catalog item (“user updated” strategy from meeting)  
- Ice Y/N on 24h checklist  
- Optional “inventory cost analysis” note fields for to-go containers / foil (placeholders)

---

## Acceptance checklist

- [ ] Cooking event gets full inventory checklist on create  
- [ ] Links open preferred suppliers  
- [ ] Ops can update a catalog URL in CRM  
- [ ] 24h triple-check task opens the same checklist  

---

## Non-goals

- Full warehouse stock quantities / accounting  
- Auto-ordering from Amazon
