# 08 — Venues + inventory catalog admin

*Client follow-up: editable house venues synced with Lead Detail; inventory catalog add/remove + purchase links.*

## Goal

1. **House venues** live in DB and are editable in Settings (not three hardcoded lists).
2. **Lead stores venue** and stays **in sync** with the linked event after convert.
3. **Inventory catalog** is editable in Settings (SKU, links, activate/deactivate).
4. **Event checklist** can add/remove rows and override purchase URLs.

## Schema

- Table `venues`: `id`, `name` (unique), `sort_order`, `is_active`, timestamps.
- `leads.venue`, `leads.venue_mode` (same enum as events).
- Migration: [`drizzle/0015_venues_and_lead_venue.sql`](../drizzle/0015_venues_and_lead_venue.sql).
- Seed: `npm run db:seed-venues` (from legacy `HOUSE_VENUES`, skips `"Other"`).

## Sync policy

- Before convert: save venue on lead (Save Deposit Info / Create Event).
- On convert: copy venue + resolved `venue_mode` onto the event.
- After convert (`converted_to_event_id`): editing lead venue patches the event; completing Deposit Intake (or patching event venue) patches the lead via `syncLeadEventVenue`.

## UI

| Surface | Behavior |
|---------|----------|
| Settings (admin) | Venues + Inventory catalog panels |
| Lead Detail | Shared venue dropdown; persist + sync when converted |
| Deposit Intake | `houseVenues` from API (`getDepositIntake`) |
| EventFormDialog | Active venues from entity API |
| Event inventory checklist | Add (catalog/custom), remove, edit `purchase_url` override |

## APIs

- Entity CRUD: `/api/venues`, `/api/inventory-catalog-items` (existing registry).
- `POST /api/events/:id/inventory` — add row.
- `DELETE /api/events/:id/inventory/:itemId` — remove row.
- Inventory seed **does not** overwrite `purchase_links` on existing catalog rows.

## Out of scope

- Hard-delete venues (use deactivate).
- Public venue pages / maps.
- Blind re-seed of purchase links.
