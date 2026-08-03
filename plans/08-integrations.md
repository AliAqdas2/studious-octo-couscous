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

Current CRM uses `calendar_link` string in `automation_config` (booking URL in emails), not full calendar sync.

### MVP

Keep `calendar_link` as manual URL in automation config — **no API needed**.

### Future

- OAuth connect Google Calendar
- Sync `events.event_date` to calendar
- Read availability for meeting scheduling

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
