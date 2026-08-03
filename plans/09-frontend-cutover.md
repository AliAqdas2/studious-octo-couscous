# 09 — Frontend Cutover

Switch the React app from `@base44/sdk` to the local Express API.

## Strategy

Replace `client/src/api/base44Client.js` with `client/src/api/apiClient.js` that exposes the **same interface** so pages need minimal changes.

```js
// apiClient.js — compatibility shim
export const api = {
  auth: { me, logout, redirectToLogin },
  entities: {
    Lead: createEntityClient('leads'),
    Client: createEntityClient('clients'),
    // ...
  },
  functions: {
    invoke: (name, payload) => post(`/api/functions/${kebabCase(name)}`, payload),
  },
  integrations: {
    Core: {
      UploadFile: (opts) => uploadFile(opts),
      ExtractDataFromUploadedFile: (opts) => extractFile(opts),
    },
  },
  users: {
    inviteUser: (email, role) => post('/api/auth/invite', { email, role }),
  },
};
```

Then rename imports: `base44` → `api` across `client/src/` (or re-export as `base44` during transition).

## Entity client factory

```js
function createEntityClient(path) {
  return {
    list: (sort, limit) => get(`/${path}`, { sort, limit }),
    filter: (filters, sort, limit) => get(`/${path}`, { ...filtersToQuery(filters), sort, limit }),
    get: (id) => get(`/${path}/${id}`),
    create: (data) => post(`/${path}`, data),
    update: (id, data) => patch(`/${path}/${id}`, data),
    delete: (id) => del(`/${path}/${id}`),
    bulkCreate: (rows) => post(`/${path}/bulk`, { rows }),
  };
}
```

## Auth changes

### Remove Base44-specific code

- `app-params.js` — remove `VITE_BASE44_APP_ID`, token from URL (or keep for migration window)
- `AuthContext.jsx` — remove public settings fetch to Base44; use `GET /api/auth/me` only

### Add login page

- `client/src/pages/Login.jsx`
- Route `/login` outside `Layout`
- Redirect unauthenticated users from `AuthProvider`

### Env vars (simplified)

```env
# Remove when fully cut over:
# VITE_API_BASE_URL
# VITE_BASE44_APP_ID

# API is same-origin — no VITE_ needed for API URL
```

All API calls use relative `/api/...` (same Express origin).

## Function name mapping

| SDK invoke name | New endpoint |
|-----------------|--------------|
| `getLeadsPaginated` | `POST /api/leads/search` |
| `triggerCallTwiML` | `POST /api/calls/trigger` |
| `analyzeCall` | `POST /api/calls/:id/analyze` |
| `generateEventWorkflow` | `POST /api/events/:id/generate-workflow` |
| `createEventFromWonLead` | `POST /api/leads/:id/create-event` |
| `syncGmailEmails` | `POST /api/gmail/sync` |
| `createGmailDraft` | `POST /api/gmail/drafts` |
| `sendGmailEmail` | `POST /api/gmail/send` |
| `getEmailDetail` | `GET /api/gmail/messages/:id` |
| `getDraftDetail` | `GET /api/gmail/drafts/:id` |
| `replyToEmail` | `POST /api/gmail/reply` |
| `logLeadEmailActivity` | `POST /api/gmail/log-activity` |
| `postSystemMessage` | `POST /api/tasks/system-message` |
| `validateTaskSync` | `POST /api/tasks/validate-sync` |
| `autoRepairTaskSync` | `POST /api/tasks/repair-sync` |

## package.json cleanup

Remove when cutover complete:

```json
"@base44/sdk"
```

## Cutover phases

1. **Dual mode** — `VITE_USE_LOCAL_API=true` switches apiClient vs base44Client
2. **Entity CRUD only** — test all list pages against local API
3. **Auth** — login page, session cookies
4. **Functions** — leads search, calls, gmail
5. **Remove Base44** — delete sdk, env vars, app-params Base44 fields

## Files to change

```
client/src/api/apiClient.js          (new)
client/src/api/base44Client.js       (delete or re-export apiClient)
client/src/lib/AuthContext.jsx
client/src/lib/app-params.js         (simplify)
client/src/pages/Login.jsx           (new)
client/src/App.jsx                   (add /login route)
All pages using base44.*             (import swap)
```

## Verification

- [ ] Full app works with `npm run dev` — no external Base44 URL
- [ ] Login → dashboard loads with data from Postgres
- [ ] All 24 pages load without SDK errors
- [ ] Gmail send/sync works
- [ ] Trigger call works
- [ ] Production build + start works with session cookies
