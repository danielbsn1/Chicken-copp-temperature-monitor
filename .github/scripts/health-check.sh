#!/usr/bin/env bash
# Falha se GET $HEALTH_URL não responder 200 dentro do tempo limite (~1 min).
set -euo pipefail
status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --retry 6 --retry-delay 5 --retry-all-errors --max-time 15 "$HEALTH_URL" || true)
echo "GET /api/health -> $status"
test "$status" = "200"
