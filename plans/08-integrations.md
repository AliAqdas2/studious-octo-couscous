# 08 — Integrations

File upload, AI data extraction, and Google Calendar (secondary).

## File upload & AI extract

### Frontend usage

```js
base44.integrations.Core.UploadFile({ file })
base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema })
```

Used in:
- `ImportLeadsDialog.jsx` — CSV → leads
- `ClientDatabase.jsx` — CSV → clients
- `ConfirmedEvents.jsx` — CSV → events

### Replacement API

```
POST   /api/files/upload              multipart/form-data → { file_url }
POST   /api/files/extract             { file_url, schema } → parsed rows
```

### Storage

| Option | Notes |
|--------|-------|
| Local `uploads/` | MVP, serve via Express static |
| S3 / Supabase Storage | Production |

### Extract implementation

1. Download file from `file_url`
2. If CSV: parse with `papaparse` or similar
3. If PDF/image: use OpenAI vision / document API
4. Return array matching JSON schema (columns for leads/clients/events)

Port schema definitions from Base44 extract calls in each dialog.

### Env

```env
OPENAI_API_KEY=
UPLOAD_DIR=./uploads
# or
S3_BUCKET=
```

## Google Calendar

Base44 connector: `googlecalendar.jsonc` — scopes for calendar events.

Mangia reuses the **same Gmail OAuth connection** with Calendar scopes
(`calendar.readonly` + `calendar.events`). Reconnect Gmail after scope changes
and enable the Google Calendar API on the GCP project.

### Implemented

- `findNextFreeSlot` — Mon–Fri **9:00–17:00 America/New_York**, 30-min slots,
  skip primary busy + US holidays (`server/services/calendar/findNextFreeSlot.ts`)
- Survey call-failure drafts replace `<<Sales Manager Availability>>` and set
  `proposed_meeting_date`
- `GET /api/calendar/next-slot` — UI draft template merge
- Meeting confirmation replies → stage update + ICS invite
  (`handleMeetingConfirmationReply`)

### Also still used

`calendar_link` string in `automation_config` — booking URL in post-call emails
when a live call succeeds (separate from freeBusy proposals).

### Future

- Sync `events.event_date` to Google Calendar
- Multi-calendar / per-rep calendars
## OpenAI usage summary

| Feature | Function |
|---------|----------|
| Call transcript analysis | `analyzeCall` |
| Email → lead extract | `extractLeadFromEmail` |
| Spam classification | contact form handler |
| CSV/ file extract | `ExtractDataFromUploadedFile` |
| Lead type detection | `autoDetectLeadType` |

Centralize in `server/services/ai/openaiClient.ts` with typed prompts.

## Dependencies

```bash
npm install multer papaparse openai
# optional: @aws-sdk/client-s3
```

## Files to create

```
server/routes/files.ts
server/services/files/upload.ts
server/services/files/extract.ts
server/services/ai/openaiClient.ts
server/services/ai/prompts/
uploads/                    (.gitignore)
```

## Verification

- [ ] CSV upload returns file_url
- [ ] Lead import extract returns row array
- [ ] Client bulk create from extract works
- [ ] Event bulk import from extract works
- [ ] Large files rejected (>10MB)
