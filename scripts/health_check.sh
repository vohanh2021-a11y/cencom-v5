#!/usr/bin/env bash
set -euo pipefail

# Health check script - curl health endpoint
# Exit 0 if "ok":true, exit 1 nếu fail

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/health}"

# Thử curl với timeout 5 giây
RESPONSE=$(curl -sf --max-time 5 "$HEALTH_URL" 2>/dev/null) || {
  echo "❌ Health check fail: unable to reach $HEALTH_URL"
  exit 1
}

# Kiểm tra response body có chứa "ok":true không
if echo "$RESPONSE" | grep -q '"ok":\s*true' 2>/dev/null; then
  exit 0
fi

echo "❌ Health check fail: response doesn't contain 'ok':true"
exit 1