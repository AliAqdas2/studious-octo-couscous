# BEO Host Script / Instructor Bio

**Source default:** `ScriptforBEO.html` (host MC script with instructor bio slot)

## What ships in the BEO

The **Instructor Bio / Script** section is filled from:

1. **Host MC script template** — Settings → **BEO Host Script** (DB `beo_script_templates`, slug `host_mc_script`)
2. **Instructor bio** — Settings → **Instructors**, assigned on Event Detail → Instructor & attendees

Placeholders such as `{{client_name}}`, `{{host_name}}`, `{{event_name}}`, `{{experience_activity}}`, `{{instructor_name}}`, `{{instructor_bio}}`, and `{{dish_or_drink}}` are substituted when the BEO HTML is built.

## Production apply

```bash
# After deploy
# migrations (includes 0026_beo_script_templates)
# then seed default script if the row does not exist yet:
docker exec -it mangia_app node dist/seed.js
# or:
npm run db:seed-beo-scripts
```

Existing saved BEO documents are **not** rewritten automatically — open Event Detail → rebuild/regenerate the BEO in the UI after editing the template or instructor bio.

## Notes

- Re-running seed does **not** overwrite an existing host script (ops edits are preserved).
- Floor maps and other BEO sections are unchanged.
