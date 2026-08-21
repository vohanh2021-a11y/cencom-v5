#!/usr/bin/env bash
# scripts/restore_db.sh — Khôi phục PostgreSQL (cencom) từ file backup
# Hỗ trợ cả .sql.gz (gunzip) và .sql (plain).
#
# Cách chạy: bash scripts/restore_db.sh <file_backup.sql.gz|file_backup.sql>
# ⚠️ Sẽ ghi đè dữ liệu hiện tại trong DB. Hãy backup trước khi restore.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz|backup_file.sql>"
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_CONTAINER="${DB_CONTAINER:-cencom_v5_pg}"
PGUSER="${PGUSER:-postgres}"
PGDB="${PGDB:-cencom}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] File không tồn tại: $BACKUP_FILE" >&2
  exit 1
fi

echo "[restore] Khôi phục '$BACKUP_FILE' vào DB '$PGDB' (container '$DB_CONTAINER')"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" \
    | docker compose -f "$COMPOSE_FILE" exec -T "$DB_CONTAINER" \
        psql -U "$PGUSER" -d "$PGDB"
else
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_CONTAINER" \
    psql -U "$PGUSER" -d "$PGDB" < "$BACKUP_FILE"
fi

echo "[restore] Done."
