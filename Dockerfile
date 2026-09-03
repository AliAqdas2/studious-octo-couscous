# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && npx esbuild scripts/migrate-apply.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/migrate-apply.js \
    --format=esm \
  && npx esbuild scripts/seed.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed.js \
    --format=esm \
  && npx esbuild scripts/seed-email-templates.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-email-templates.js \
    --format=esm \
  && npx esbuild scripts/erase-data.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/erase-data.js \
    --format=esm \
  && npx esbuild scripts/load-data.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/load-data.js \
    --format=esm \
  && npx esbuild scripts/seed-onboarding.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-onboarding.js \
    --format=esm \
  && npx esbuild scripts/seed-inventory.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-inventory.js \
    --format=esm \
  && npx esbuild scripts/seed-venues.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-venues.js \
    --format=esm \
  && npx esbuild scripts/seed-venue-images.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-venue-images.js \
    --format=esm \
  && npx esbuild scripts/seed-instructors.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-instructors.js \
    --format=esm \
  && npx esbuild scripts/seed-eateries.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/seed-eateries.js \
    --format=esm \
  && npx esbuild scripts/send-daily-digest.ts \
    --bundle \
    --platform=node \
    --packages=external \
    --outfile=dist/send-daily-digest.js \
    --format=esm

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle
COPY venueimages ./venueimages
COPY scripts/data ./scripts/data
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
