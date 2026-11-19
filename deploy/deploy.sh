#!/usr/bin/env bash
# Deploy to Cloudflare Workers (needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID).
set -euo pipefail
cd "$(dirname "$0")"
node build-worker.mjs
NAME=word-groups-solitaire
API=https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$NAME
curl -sf -X PUT "$API" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F 'metadata={"main_module":"worker.js","compatibility_date":"2025-01-01"};type=application/json' \
  -F 'worker.js=@worker.js;type=application/javascript+module' >/dev/null
curl -sf -X POST "$API/subdomain" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H 'content-type: application/json' -d '{"enabled":true,"previews_enabled":false}' >/dev/null
echo "deployed $NAME"
