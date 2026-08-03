# 00 — Architecture

## Server folder structure (target)

```
server/
├── index.ts                 # Bootstrap, listen
├── app/
│   └── createApp.ts         # express(), global middleware
├── config/
│   └── env.ts               # Typed env accessors
├── db/                      # ✅ exists (Drizzle)
├── middleware/
│   ├── auth.ts              # requireAuth, optionalAuth
│   ├── errorHandler.ts
│   └── validate.ts          # Zod request validation
├── routes/
│   ├── index.ts             # registerRoutes — mount all routers
│   ├── health.ts
│   ├── auth.ts
│   ├── entities/
│   │   ├── index.ts         # /api/entities/:entityName/*
│   │   └── registry.ts      # entity name → table + permissions
│   ├── functions/
│   │   └── index.ts         # /api/functions/:name
│   ├── gmail.ts             # /api/gmail/*
│   └── webhooks/
│       ├── twilio.ts
│       ├── fareharbor.ts
│       └── gmail.ts
├── services/                # Business logic (no HTTP)
│   ├── entities/            # Generic CRUD service per table
│   ├── leads/
│   ├── events/
│   ├── gmail/
│   ├── twilio/
│   └── ai/
├── jobs/                    # Cron / queue workers
│   ├── pollGmailInbox.ts
│   ├── processCallRetries.ts
│   └── sendDailyDigest.ts
└── infrastructure/          # vite.ts, static.ts (move from server root)
```

## API route order (Express)

Same rule as today — API before SPA:

1. `express.json()` + cookies
2. `/webhook/*` — no auth (signature verification instead)
3. `/api/auth/*` — login/logout/callback
4. `/api/*` — authenticated routes
5. Vite (dev) or static (prod)

## Base44 SDK compatibility layer

The frontend currently uses:

```js
base44.entities.Lead.list('-created_date', 500)
base44.entities.Lead.filter({ email: 'x' }, '-created_date', 1)
base44.entities.Lead.get(id)
base44.entities.Lead.create(data)
base44.entities.Lead.update(id, data)
base44.entities.Lead.delete(id)
base44.entities.Lead.bulkCreate(rows)
base44.functions.invoke('getLeadsPaginated', payload)
base44.auth.me()
```

Two implementation options:

| Approach | Pros | Cons |
|----------|------|------|
| **A. Compatibility routes** — `/api/entities/Lead/list` mirroring SDK paths | Minimal frontend changes | Non-RESTful |
| **B. New REST + thin SDK adapter** — REST internally, adapter in `apiClient.js` | Clean API | More frontend work |

**Recommendation: B** — implement RESTful routes, replace `base44Client.js` with `apiClient.js` that exposes the same method signatures (see [09-frontend-cutover.md](./09-frontend-cutover.md)).

### Proposed REST shape

```
GET    /api/leads?page=1&sort=-created_date&filter[stage]=New Inquiry
GET    /api/leads/:id
POST   /api/leads
PATCH  /api/leads/:id
DELETE /api/leads/:id
POST   /api/leads/bulk

POST   /api/functions/get-leads-paginated   (or POST /api/leads/search)
```

Entity names map to kebab-case routes: `RoleAssignment` → `/api/role-assignments`, `CallLog` → `/api/call-logs`.

## Shared types

Add `shared/api/` for request/response types used by both server validation and (later) frontend:

```
shared/
├── api/
│   ├── entities.ts      # HealthResponse, Lead, Event, ...
│   └── pagination.ts
```

## Serialization

Drizzle uses camelCase in TS; DB uses snake_case. Add a mapper:

```ts
// server/lib/serialize.ts
export function toApiRecord<T>(row: T): Record<string, unknown> {
  // camelCase → snake_case for JSON responses
}
```

Frontend expects `created_date`, `full_name`, `assigned_sales_rep`, etc.

## Auth model

- **JWT access + refresh** (primary): short-lived access JWT (Bearer) + refresh token in HttpOnly cookie, hashed in Postgres (`refresh_tokens`)
- Deploy-safe when `JWT_SECRET` (and optional `JWT_REFRESH_SECRET`) are stable env vars — not regenerated on each deploy
- `auth.me()` returns `{ id, email, full_name, role }` matching current frontend
- Platform role: `admin` | `user` on `users` table
- Operational role: `role_assignments.role` (Sales, Ops, …)

## Error handling

Central middleware:

```ts
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});
```

## Testing strategy

- Unit: services with mocked `db`
- Integration: supertest against Express app + test Postgres
- Contract: snapshot tests for API response shape vs Base44 samples

## Security

- All entity mutations require auth
- Webhooks: Twilio signature, Gmail channel token, FareHarbor shared secret
- Gmail OAuth tokens stored encrypted in DB (new `integrations` table or `automation_config` extension)
- Rate limit `/api/auth/login` and `/api/auth/refresh`
- CORS not needed (same-origin Express)

## Dependencies to add

| Package | Purpose |
|---------|---------|
| `zod` | ✅ already installed — request validation |
| `jose` | JWT sign/verify (access tokens) |
| `cookie-parser` | Parse refresh-token HttpOnly cookie |
| `bcrypt` | Password hashing |
| `googleapis` | Gmail API |
| `twilio` | Voice |
| `node-cron` or `bullmq` | Background jobs |
| `multer` | File uploads |
| `openai` or similar | AI features |
