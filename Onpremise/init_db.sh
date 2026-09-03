#!/bin/bash
# init_db.sh — Initialize CencomOS Gara v5 database (GĐ9 — v5.3)
#
# NÂNG CẤP GĐ9 (soạn thảo trên Windows 04.09, VERIFY LẠI TRÊN UBUNTU THẬT):
#  - realtime triggers giờ nằm TRONG db/migrate.ts (pipeline 3 file idempotent)
#    → bỏ dòng psql hardcode mật khẩu 'postgres'.
#  - DATABASE_URL constructed from .env.onpremise.local (DB_PASSWORD thật,
#    không còn giả định pass mặc định).
#  - tạo tài khoản MCP chuyên dụng (MCP_USER/MCP_PASS trong env) — MCP HTTP
#    fail-closed: hết crash-loop 'login failed' khi khởi tạo lần đầu.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.onpremise.local}"
[ -f "$ENV_FILE" ] || ENV_FILE="$SCRIPT_DIR/.env.onpremise"
if [ ! -f "$ENV_FILE" ]; then
  echo "LỖI: cần .env.onpremise.local (copy từ .env.onpremise, điền secrets)" >&2
  exit 1
fi
# nạp biến (chỉ KEY=VALUE, bỏ comment)
set -a; . <(grep -E '^[A-Z0-9_]+=' "$ENV_FILE"); set +a

DB_USER="${DB_USER:-postgres}"; DB_NAME="${DB_NAME:-cencom}"
DB_PORT_HOST="${DB_PORT_HOST:-5432}"   # Windows dev override: 5433
[ -n "${DB_PASSWORD:-}" ] || { echo "LỖI: DB_PASSWORD trống trong $ENV_FILE" >&2; exit 1; }

V5_DIR="$(dirname "$SCRIPT_DIR")/gara_reconstruction_v5"
export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT_HOST}/${DB_NAME}"

echo "=== CencomOS Gara v5 — Database Init ==="

# 1) Bật db container trước (healthcheck gate)
if ! docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/docker-compose.yml" ps db 2>/dev/null | grep -q "Up.*healthy"; then
  echo "Khởi động db..."
  docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/docker-compose.yml" up -d db
  for i in $(seq 1 30); do
    docker exec cencom_v5_db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
    sleep 2
  done
fi

cd "$V5_DIR"

# 2) Migrate + seed (migrate.ts = schema.sql + accounting.sql + realtime_triggers.sql,
#    idempotent, tự bỏ schema.sql nếu DB đã init lần 1)
echo "[init_db] migrate (schema + accounting + realtime triggers)..."
npx tsx db/migrate.ts
echo "[init_db] seed (42 xe + 5 users + vattu mẫu)..."
npx tsx db/seed.ts

# 3) Tài khoản MCP (tùy chọn — có trong env thì new/add role + pass)
MCP_USER="${MCP_USER:-}" MCP_PASS_VAL="${MCP_PASS:-}"
if [ -n "$MCP_USER" ] && [ -n "$MCP_PASS_VAL" ]; then
  echo "[init_db] create/update MCP account '$MCP_USER' (role=${MCP_ROLE:-giamdoc})..."
  npx tsx scripts/create-mcp-user.ts "$MCP_USER" "$MCP_PASS_VAL" "${MCP_ROLE:-giamdoc}"
else
  echo "[init_db] ⚠ SKIP MCP account — MCP_USER/MCP_PASS chưa set trong env; MCP HTTP sẽ fail-closed khi up"
fi

echo "=== Database initialized successfully ==="
echo "Tiếp theo: docker compose --env-file $ENV_FILE up -d   →   node scripts/smoke_onpremise.mjs"
