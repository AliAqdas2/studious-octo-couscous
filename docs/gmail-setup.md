# Connect Gmail to Mangia CRM

One shared CRM mailbox is connected once (admin OAuth). That connection powers outbound email (draft/send/reply), inbox → lead intake, and email activity sync.

Use the **Mangia DC inbox** (or whichever shared address should own CRM mail), not a personal Gmail.

---

## 1. Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select (or create) a project.
2. Enable **Gmail API** (APIs & Services → Library → Gmail API → Enable).
3. Create OAuth credentials:
   - APIs & Services → **Credentials** → **Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs (dev example):

     ```
     http://localhost:5002/api/gmail/oauth/callback
     ```

     For production, add your real HTTPS callback, e.g. `https://your-domain.com/api/gmail/oauth/callback`.
4. Copy the **Client ID** and **Client secret**.
5. Under **OAuth consent screen**, add the test users who will click “Connect” (while the app is in Testing mode), or publish the app for production.

Scopes used by the CRM:

- `gmail.readonly`
- `gmail.compose`
- `gmail.send`
- `userinfo.email`

---

## 2. Env vars

In `mangia-crm/.env` (see also `.env.example`):

```env
APP_URL=http://localhost:5002

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5002/api/gmail/oauth/callback
GMAIL_SENDER_EMAIL=your-shared-inbox@yourdomain.com
```

`GOOGLE_REDIRECT_URI` must match the redirect URI registered in Google Cloud **exactly**.

Restart the server after changing env (`tsx` does not hot-reload server code):

```bash
PORT=5002 npm run dev
```

---

## 3. Connect (OAuth)

**Preferred:** After logging into the CRM, use the amber **Gmail is not connected** banner at the top of the page and click **Connect**. That starts Google consent with your session auth, then returns to the app with a success toast.

Alternatively (manual):

1. Log into Mangia CRM as an admin (`/login`).
2. In the browser (while logged in), open:

   ```
   http://localhost:5002/api/gmail/oauth/start
   ```

   Note: this redirect only works if the request includes your JWT (the in-app **Connect** button does). A plain bookmark often returns `401` — use the banner instead.
3. Sign in as the **shared CRM mailbox** and approve access.
4. Google redirects to `/api/gmail/oauth/callback`, which stores tokens in `gmail_connections`, then redirects to the app with `?gmail=connected`.

### Check status

```bash
# After login, copy your access token from the app network tab, or call:
curl -s http://localhost:5002/api/gmail/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected when connected:

```json
{ "connected": true, "email": "your-shared-inbox@yourdomain.com" }
```

When not connected:

```json
{ "connected": false, "email": null }
```

---

## 4. What works after OAuth alone

With Gmail connected (no Pub/Sub yet):

| Feature | Status |
|---------|--------|
| View email / draft / send / reply (Lead Detail) | Works |
| Sync emails → activity (`logLeadEmailActivity`) | Works |
| Confirmation email on create-event | Works if connected |
| Real-time inbox → Lead | Needs Pub/Sub watch (below) **or** poller |

---

## 5. Real-time inbox → Lead (optional Pub/Sub)

OAuth alone does **not** push new mail into the CRM. For live intake:

### A. Create a Pub/Sub topic

1. In Google Cloud: **Pub/Sub** → Create topic, e.g. `gmail-crm-push`.
2. Grant Gmail permission to publish:

   ```text
   Principal: serviceAccount:gmail-api-push@system.gserviceaccount.com
   Role: Pub/Sub Publisher
   ```

3. Create a **Push** subscription to your CRM webhook:

   ```text
   Endpoint URL: https://YOUR_PUBLIC_HOST/webhook/gmail
   ```

   Localhost is not reachable by Google. Use a tunnel (ngrok, Cloudflare Tunnel, etc.) in dev, or deploy first.

4. Put the topic name in `.env`:

   ```env
   GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-crm-push
   # optional shared secret — set the same value as header X-Gmail-Webhook-Secret on the push config if you add a custom auth layer
   GMAIL_WEBHOOK_SECRET=
   ```

5. Register the Gmail watch (authenticated admin):

   ```bash
   curl -X POST http://localhost:5002/api/gmail/watch \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

   Success returns `historyId` and `expiration`. Gmail watch expires ~7 days; re-call `/api/gmail/watch` before then (or automate later).

### B. Safety-net poller

If the webhook is quiet for **90+ minutes**, a cron can catch missed mail:

```env
ENABLE_JOBS=true
```

Or run once manually:

```bash
curl -X POST http://localhost:5002/api/gmail/poll \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### C. AI for classification

Inbox → Lead uses Claude (via the AI provider abstraction). Without a key, filter-only paths still work; LLM classify/create returns an error until configured:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514
```

---

## 6. Manual / test intake (no Pub/Sub)

Replay specific Gmail message IDs (mailbox must already be connected):

```bash
curl -X POST http://localhost:5002/webhook/gmail \
  -H "Content-Type: application/json" \
  -d '{"data":{"new_message_ids":["MESSAGE_ID_FROM_GMAIL"]}}'
```

Find message IDs in Gmail API / Google Cloud logs, or from activity rows after a sync.

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Gmail OAuth is not configured` (503) | Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, restart server |
| `redirect_uri_mismatch` | Redirect URI in Google Console must match `GOOGLE_REDIRECT_URI` exactly |
| `401` on `/api/gmail/oauth/start` | Log into the CRM first in that browser |
| `Gmail not connected` on send/draft | Complete OAuth again; check `GET /api/gmail/status` |
| Token expired / reconnect | Open `/api/gmail/oauth/start` again (refresh tokens are stored; full reconnect if revoked) |
| Watch returns 503 for topic | Set `GMAIL_PUBSUB_TOPIC` and grant `gmail-api-push@system.gserviceaccount.com` Publisher |
| Pub/Sub never hits CRM | Endpoint must be public HTTPS; confirm push subscription URL is `/webhook/gmail` |
| Leads not created from mail | Connect Gmail + set `ANTHROPIC_API_KEY`; check Spam Emails page and `processed_gmail_messages` |

---

## Quick checklist

1. [ ] Gmail API enabled  
2. [ ] OAuth client + redirect URI  
3. [ ] `.env` filled (`GOOGLE_*`, `APP_URL`)  
4. [ ] Server restarted  
5. [ ] Logged in → click **Connect** on the in-app Gmail banner → approve as shared mailbox  
6. [ ] Banner disappears / `GET /api/gmail/status` → `connected: true`  
7. [ ] (Production intake) Pub/Sub topic + push to `/webhook/gmail` + `POST /api/gmail/watch`  
8. [ ] (Intake AI) `ANTHROPIC_API_KEY` set  
9. [ ] (Backup) `ENABLE_JOBS=true` optional  
