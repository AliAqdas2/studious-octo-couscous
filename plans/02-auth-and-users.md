# 02 — Auth & Users

Replace `base44.auth.*` and `base44.entities.User.*` with Express JWT auth backed by the `users` table and DB-stored refresh tokens.

## Frontend usage to replace

```js
base44.auth.me()
base44.auth.logout()
base44.auth.redirectToLogin(returnUrl)
base44.auth.logout(window.location.href)

base44.entities.User.list()
base44.entities.User.update(id, { role: 'admin' })
base44.entities.User.delete(id)
base44.users.inviteUser(email, 'admin' | 'user')
```

Also: `AuthContext.jsx` fetches public app settings from Base44 — replace with local config or remove.

## Auth routes

```
POST   /api/auth/login              { email, password } → { accessToken, user } + Set-Cookie refreshToken
POST   /api/auth/refresh            → { accessToken } + rotate refresh cookie (cookie auto-sent)
POST   /api/auth/logout             → revoke refresh token, clear cookie
GET    /api/auth/me                 Current user (Bearer access JWT)
POST   /api/auth/register           Admin-only: create user
POST   /api/auth/invite             Admin-only: invite by email
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/google               OAuth start (optional, for Gmail-linked login)
GET    /api/auth/google/callback
```

## JWT + Refresh tokens

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| **Access JWT** | 15 min | Client memory only (React state / module ref) | `Authorization: Bearer` on API calls |
| **Refresh token** | 30 days | HttpOnly, `Secure` (prod), `SameSite=Lax` cookie | Rotated on each refresh; SHA-256 hashed in DB |

- **JWT payload (minimal):** `{ sub: userId, email, role, iat, exp }`
- **Secrets:** `JWT_SECRET` (required) and optional `JWT_REFRESH_SECRET` — stable env vars, never regenerated per deploy
- **Middleware:** `requireAuth` validates Bearer JWT on all `/api/*` except `/api/auth/login`, `/api/auth/refresh`, `/api/health`, and webhooks
- **Reuse detection:** rotating refresh on `/refresh`; if an old token is reused, revoke all tokens for that user

### `GET /api/auth/me` response

```json
{
  "id": "uuid",
  "email": "rep@mangia.com",
  "full_name": "Jane Rep",
  "role": "admin"
}
```

Matches what `Layout.jsx`, `Tasks.jsx`, and `RoleAssignmentDialog.jsx` expect.

## Users table extensions

Add to schema (migration):

```ts
passwordHash: varchar('password_hash', { length: 255 })  // bcrypt
inviteToken: varchar('invite_token', { length: 255 })
inviteExpiresAt: timestamp('invite_expires_at')
lastLoginAt: timestamp('last_login_at')
```

## Refresh tokens table

```ts
// server/db/schema/refresh-tokens.ts
id, userId (FK users), tokenHash, expiresAt, createdAt, revokedAt, userAgent?, ip?
```

Store only the SHA-256 hash of the refresh token; raw value lives only in the HttpOnly cookie.

## User CRUD

Use entity API from [01-entity-crud-api.md](./01-entity-crud-api.md) with restrictions:

| Endpoint | Who |
|----------|-----|
| `GET /api/users` | Admin only |
| `DELETE /api/users/:id` | Admin only |
| `PATCH /api/users/:id` | Admin (role changes) or self (name, phone) |

Never return `password_hash`.

## Role assignments

Operational roles live in `role_assignments` — already covered by entity CRUD.

Frontend flow in `Layout.jsx`:

1. `auth.me()` → user
2. `RoleAssignment.filter({ user_id })` → assignment
3. No assignment → `ActivationPending` page
4. `is_active: false` → deactivated screen

Ensure `POST /api/role-assignments` can create assignment without `user_id` (contact-only user from `AddUserDialog`) or with `user_id` after invite.

## Invite flow (replaces `base44.users.inviteUser`)

1. Admin calls `POST /api/auth/invite` with `{ email, role: 'admin' | 'user', full_name, operational_role }`
2. Server creates `users` row (no password), generates invite token
3. Send email with link: `/accept-invite?token=...`
4. User sets password → `is_active: true`
5. Create `role_assignments` row

For MVP without email: return invite link in API response for admin to copy.

## Replace AuthContext public settings check

Current code fetches `/api/apps/public/prod/public-settings/by-id/${appId}` from Base44.

**Option A**: Remove check; app always loads if access token valid.

**Option B**: `GET /api/app/settings` returns `{ id, public_settings: {} }` stub.

Recommend **Option A** for self-hosted CRM.

## Login page

Base44 redirects to external login. Add `client/src/pages/Login.jsx` + route when cutting over frontend.

## Frontend transport (Phase 3)

When replacing `@base44/sdk`, `apiClient.js` must:

1. Hold `accessToken` in memory (AuthContext state) — never `localStorage`
2. Attach `Authorization: Bearer` on all requests
3. On `401`: call `POST /api/auth/refresh` once, retry original request
4. On refresh failure: redirect to `/login`

## Security checklist

- [ ] bcrypt cost factor 12
- [ ] Rate limit login and refresh (5 attempts / 15 min per IP)
- [ ] Refresh token rotation on every `/refresh`
- [ ] Reuse of revoked/old refresh → revoke all user tokens
- [ ] Admin cannot delete self
- [ ] CSRF: same-site cookies sufficient for SPA; access token not in cookies for API calls

## Files to create

```
server/routes/auth.ts
server/services/auth/authService.ts
server/services/auth/tokenService.ts
server/middleware/auth.ts
server/db/schema/refresh-tokens.ts
drizzle migration for users.password_hash, refresh_tokens table
```

## Verification

- [ ] Login → `auth.me()` returns user with Bearer token
- [ ] Logout revokes refresh token; old cookie rejected
- [ ] Server restart with same `JWT_SECRET` → refresh still works
- [ ] Non-admin cannot list users
- [ ] User without role assignment sees activation pending (frontend unchanged)
- [ ] `RoleAssignmentDialog` can set user role admin/user via PATCH
