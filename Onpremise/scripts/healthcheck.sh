#!/usr/bin/env bash
# =============================================================================
# healthcheck.sh — Kiểm tra nhanh trạng thái app CencomOS Gara (on-premise)
#
# Dùng:  bash scripts/healthcheck.sh
#        HEALTH_URL=https://localhost/api/health bash scripts/healthcheck.sh
#
# Exit code:
#   0 = HEALTHY (container chạy + Nginx phản hồi /api/health)
#   1 = UNHEALTHY (container không chạy hoặc Nginx không phản hồi)
#
# Có thể dùng trong cron để gửi cảnh báo, hoặc trong script giám sát ngoài.
# =============================================================================
set -uo pipefail

NGINX_URL="${HEALTH_URL:-https://localhost/api/health}"
APP_URL="${APP_DIRECT_URL:-http://localhost:3000/api/health}"
CONTAINER="${APP_CONTAINER:-cencom-web}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"

echo "[healthcheck] $(date -u +%FT%TZ)"

# 1) Container web có đang chạy không
if ! docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '$CONTAINER' không chạy."
  exit 1
fi
echo "✅ Container '$CONTAINER' đang chạy."

# 2) Health qua Nginx (user-facing, self-signed → dùng -k)
if curl -fsS -k "$NGINX_URL" >/dev/null 2>&1; then
  echo "✅ Nginx health ($NGINX_URL): OK"
  NGINX_OK=1
else
  echo "⚠️  Nginx health ($NGINX_URL): KHÔNG phản hồi."
  NGINX_OK=0
fi

# 3) Chẩn đoán: app trực tiếp (bỏ qua Nginx)
if curl -fsS "$APP_URL" >/dev/null 2>&1; then
  echo "ℹ️  App trực tiếp ($APP_URL): OK (dùng chẩn đoán khi Nginx lỗi)."
else
  echo "ℹ️  App trực tiếp ($APP_URL): KHÔNG phản hồi."
fi

# 4) Chẩn đoán: PostgreSQL
if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
  echo "ℹ️  PostgreSQL ($DB_CONTAINER): sẵn sàng."
else
  echo "ℹ️  PostgreSQL ($DB_CONTAINER): KHÔNG sẵn sàng."
fi

if [ "${NGINX_OK:-0}" = "1" ]; then
  echo "[healthcheck] TỔNG KẾT: HEALTHY"
  exit 0
else
  echo "[healthcheck] TỔNG KẾT: UNHEALTHY"
  exit 1
fi
