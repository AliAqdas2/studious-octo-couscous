# Docker production deploy

## What you get

| File | Role |
|------|------|
| [`Dockerfile`](../Dockerfile) | Multi-stage Node 22 build → production image |
| [`docker-compose.yml`](../docker-compose.yml) | Single `app` service (DB stays on Supabase via `DATABASE_URL`) |
| [`docker/entrypoint.sh`](../docker/entrypoint.sh) | Runs migrations, then `node dist/index.js` |
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | On push to `main`/`master`, SSH → pull → `docker compose up -d --build` |
| [`scripts/deploy.sh`](../scripts/deploy.sh) | Manual deploy on the server |

External Postgres (Supabase) is expected. Do not put secrets in the image; use `.env` on the server only.

---

## 1. First-time server setup

On the VPS (Docker + Compose v2 installed):

```bash
# Install Docker if needed: https://docs.docker.com/engine/install/
sudo apt update && sudo apt install -y git

# App directory (match GitHub secret DEPLOY_PATH)
mkdir -p ~/mangia-crm
cd ~/mangia-crm

# Clone your repo (or copy files)
git clone <YOUR_REPO_URL> .
# OR: scp/rsync Dockerfile docker-compose.yml docker/ drizzle/ package* etc.

# Paste production env (never commit this)
nano .env
```

### Required `.env` for production

Copy from `.env.example` and set at least:

```env
PORT=5000
HOST_PORT=5000
DATABASE_URL=postgresql://...@...pooler.supabase.com:6543/postgres?sslmode=require
JWT_SECRET=...
JWT_REFRESH_SECRET=...
APP_URL=https://mangiadccrm.vortech.dev
ENABLE_JOBS=true
RUN_MIGRATIONS=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://mangiadccrm.vortech.dev/api/gmail/oauth/callback
# Twilio, Anthropic, etc.
```

Point your reverse proxy (Caddy/Nginx) at `127.0.0.1:5000` (or `HOST_PORT`).

### First start

```bash
cd ~/mangia-crm
chmod +x scripts/deploy.sh docker/entrypoint.sh
./scripts/deploy.sh
# or: docker compose up -d --build
curl -s http://127.0.0.1:5000/api/health
```

---

## 2. GitHub Actions auto-deploy (push → SSH)

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Example |
|--------|---------|
| `DEPLOY_HOST` | `mangiadccrm.vortech.dev` or server IP |
| `DEPLOY_USER` | `ubuntu` / `root` / deploy user |
| `DEPLOY_SSH_KEY` | Private key (full PEM) for that user |
| `DEPLOY_PATH` | `/home/ubuntu/mangia-crm` |
| `DEPLOY_PORT` | `22` (optional) |

On the server, authorize the matching **public** key in `~/.ssh/authorized_keys`.

Ensure the deploy user can run Docker without password prompts (`docker` group).

Push to `main` (or `master`), or run the workflow manually (**Actions → Deploy → Run workflow**).

The job:

1. SSHs into the server  
2. `git fetch` + hard reset to `origin/main`  
3. `docker compose up -d --build`  
4. Waits until `/api/health` succeeds  

---

## 3. Useful commands on the server

```bash
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down
# Rebuild without cache
docker compose build --no-cache && docker compose up -d
# Import pipeline email templates (one-shot upsert)
docker compose exec app node dist/seed-email-templates.js
# Send daily digest now (same as 7 AM ET cron; does not disable the schedule)
docker exec -it mangia_app node dist/send-daily-digest.js
```

---

## 4. Notes

- Migrations run on container start (`RUN_MIGRATIONS=true`). Set `false` to skip.
- Default admin is seeded on start if missing (`RUN_SEED=true`, uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, defaults `admin@mangia.com` / `changeme`).
- Jobs (Gmail poll, call retries, daily digest) default to **on** in Compose via `ENABLE_JOBS`; override in `.env`.
- Manual digest anytime: `docker exec -it mangia_app node dist/send-daily-digest.js` (or locally `npm run jobs:send-digest`).
- Health: `GET /api/health` (checks DB).
- Image does not embed `.env`; keep secrets only on the server.

### Seed email templates (one-shot)

Pipeline email templates live in [`scripts/data/email-templates.csv`](../scripts/data/email-templates.csv). They are **not** seeded on every deploy. After the image is up:

```bash
# Production (Docker)
docker compose exec app node dist/seed-email-templates.js

# Local / host (DATABASE_URL set)
npm run db:seed-email-templates
```

Safe to re-run: upserts by `template_name` + `pipeline_stage`.

### Erase + load CRM data from `scripts/data`

For a production refresh from Base44 CSV exports in [`scripts/data/`](../scripts/data/):

1. **Erase** business tables (leads, events, tasks, clients, logs, templates, etc.).  
   **Kept:** `users`, `refresh_tokens`, `gmail_connections`, Drizzle migrations.  
   You must type exactly: `ERASE PRODUCTION DATA`

```bash
# Local (DATABASE_URL set, interactive terminal; needs tsx/dev deps)
npm run db:erase

# Docker / production image (compiled scripts in dist/)
docker exec -it mangia_app node dist/erase-data.js
# or:
docker exec -it mangia_app npm run db:erase:prod
```

2. **Load** CSVs (remaps Base44 IDs → UUIDs). Prefer after erase + migrations:

```bash
# Local
npm run db:load-data
npm run db:load-data -- --skip-heavy

# Docker / production
docker exec -it mangia_app node dist/load-data.js
docker exec -it mangia_app node dist/load-data.js --skip-heavy
# or:
docker exec -it mangia_app npm run db:load-data:prod
```

3. Ensure admin exists:

```bash
docker exec -it mangia_app node dist/seed.js
```

Local file uploads under `STORAGE_DIR` / `data/uploads` are **not** wiped by erase — remove that volume separately if needed.

> The production image does **not** include TypeScript sources or `tsx`. Always use `node dist/erase-data.js` / `node dist/load-data.js` (or the `*:prod` npm scripts) inside the container. Rebuild the image after pulling these script changes.
