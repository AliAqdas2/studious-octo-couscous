#!/usr/bin/env bash
# Smoke-test POST /webhook/leads (skips Twilio auto-call).
set -euo pipefail

BASE_URL="${APP_URL:-https://portal.mangiadc.com}"
SECRET="${LEAD_WEBHOOK_SECRET:-UojdtV5daUG3N9UdqJ_UEufAui}"
STAMP="$(date +%s)"

curl -sS -w "\nHTTP %{http_code}\n" -X POST "${BASE_URL%/}/webhook/leads" \
  -H "Content-Type: application/json" \
  -H "X-Lead-Webhook-Secret: ${SECRET}" \
  -d "{
    \"name\": \"Webhook Test ${STAMP}\",
    \"email\": \"webhook-test-${STAMP}@example.com\",
    \"phone\": \"+12025550199\",
    \"company\": \"Webhook Test Co\",
    \"notes\": \"Manual webhook smoke test\",
    \"skip_auto_call\": true
  }"
