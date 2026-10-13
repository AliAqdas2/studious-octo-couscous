# Lead webhook (create lead)

Post a new lead into [Mangia CRM](https://portal.mangiadc.com/). On success, Mangia runs the normal create pipeline (enrich + auto-call / survey draft).

## Endpoint

| | |
|---|---|
| **URL** | `https://portal.mangiadc.com/webhook/leads` |
| **Method** | `POST` |
| **Content-Type** | `application/json` |
| **Secret** | `UojdtV5daUG3N9UdqJ_UEufAui` |

Send the secret in either header:

- `X-Lead-Webhook-Secret: UojdtV5daUG3N9UdqJ_UEufAui`
- or `Authorization: Bearer UojdtV5daUG3N9UdqJ_UEufAui`

## Body

**Required:** `name`, `email`

**Optional:** `phone`, `company`, `title`, `notes`, `event_type` / `event_type_interest`, `headcount_estimate` / `guest_count`, `preferred_date` / `event_date` (ISO), `inquiry_type`, `referral_source`, `skip_auto_call` (bool), `source` (default `Form`; also `Website`, `Email`, `Phone`, `Referral`, `Call`, `Other`)

Snake_case or camelCase both work.

## Example

```bash
curl -X POST "https://portal.mangiadc.com/webhook/leads" \
  -H "Content-Type: application/json" \
  -H "X-Lead-Webhook-Secret: UojdtV5daUG3N9UdqJ_UEufAui" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+12025550123",
    "company": "Acme",
    "notes": "Team dinner for 40"
  }'
```

## Responses

| Status | Meaning |
|--------|---------|
| `201` | Created — `{ "ok": true, "id": "<uuid>", "crm_url": "..." }` |
| `400` | Missing/invalid fields |
| `403` | Bad or missing secret |
| `503` | Webhook not configured / DB down |

Treat this secret like a password — do not commit it to public repos.
