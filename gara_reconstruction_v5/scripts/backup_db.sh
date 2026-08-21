#!/usr/bin/env bash
# scripts/backup_db.sh — Backup PostgreSQL (cencom) từ container db
# Xuất ra file .sql.gz nén, tự prune theo RETENTION_DAYS.
#
# Env có thể override:
#   COMPOSE_FILE, DB_CONTAINER, PGUSER, PGDB, BACKUP_DIR, RETENTION_DAYS
#
# Cách chạy: bash scripts/backup_db.sh

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_CONTAINER="${DB_CONTAINER:-cencom_v5_pg}"
PGUSER="${PGUSER:-postgres}"
PGDB="${PGDB:-cencom}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/cencom_v5_${TS}.sql.gz"

echo "[backup] Dumping '$PGDB' từ container '$DB_CONTAINER' -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T "$DB_CONTAINER" \
  pg_dump -U "$PGUSER" -d "$PGDB" --no-owner --clean --if-exists \
  | gzip > "$OUT"

if [ ! -s "$OUT" ]; then
  echo "[backup] LỖI: file backup rỗng." >&2
  rm -f "$OUT"
  exit 1
fi

echo "[backup] Done: $OUT ($(du -h "$OUT" | cut -f1))"

# Prune các bản cũ
find "$BACKUP_DIR" -name 'cencom_v5_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
echo "[backup] Giữ lại bản trong $RETENTION_DAYS ngày."
