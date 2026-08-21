#!/bin/bash
# Health check script for cencomOS gara reconstruction v5
# Checks http://localhost:3001/api/health or HEALTH_URL env variable
# Exit 0 if {"ok": true}, exit 1 otherwise

set -e

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/response}"

# Allow override via environment variable
if [[ -n "${HEALTH_OVERRIDE_URL:-}" ]]; then
  HEALTH_URL="${HEALTH_OVERRIDE_URL}"
fi

if [[ -z "$HEALTH_URL" ]]; then
  echo "ERROR: HEALTH_URL not set and no default available" >&2
  exit 1
fi

# Perform the curl request
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$HEALTH_URL" 2>/dev/null) || {
  echo "ERROR: curl failed to reach $HEALTH_URL" >&2
  exit 1
}

# Check if the response contains {"ok": true}
# We need to get the full response body to check the "ok" field
RESPONSE=$(curl -s --connect-timeout 5 --max-time 10 "$HEALTH_URL" 2>/dev/null) || {
  echo "ERROR: curl failed to get response from $HEALTH_URL" >&2
  exit 1
}

# Check for ok: true in response
if echo "$RESPONSE" | grep -q '"ok":\s*true'; then
  echo "Health check passed: $HEALTH_URL is ok"
  exit 0
else
  echo "Health check failed: $HEALTH_URL does not return ok=true"
  echo "Response: $RESPONSE"
  exit 1
fi