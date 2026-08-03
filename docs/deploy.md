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
```

---

## 4. Notes

- Migrations run on container start (`RUN_MIGRATIONS=true`). Set `false` to skip.
- Default admin is seeded on start if missing (`RUN_SEED=true`, uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, defaults `admin@mangia.com` / `changeme`).
- Jobs (Gmail poll, call retries, daily digest) default to **on** in Compose via `ENABLE_JOBS`; override in `.env`.
- Health: `GET /api/health` (checks DB).
- Image does not embed `.env`; keep secrets only on the server.
