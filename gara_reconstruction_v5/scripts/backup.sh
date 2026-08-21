#!/bin/bash
# Backup script for cencomOS gara reconstruction v5
# Performs pg_dump of the cencom database, keeps 7 most recent backups
# Usage: bash scripts/backup.sh
# Environment: PG* variables or DATABASE_URL from .env.local

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="${PROJECT_DIR}/scripts"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Determine database connection
if [[ -n "${DATABASE_URL:-}" ]]; then
  PG_CONNECTION="DATABASE_URL=$DATABASE_URL"
elif [[ -n "${PG_CONNECTION_STRING:-}" ]]; then
  PG_CONNECTION="PG_CONNECTION_STRING=$PG_CONNECTION_STRING"
else
  # Try to read from .env.local
  if [[ -f "${PROJECT_DIR}/.env.local" ]]; then
    # shellcheck source=/dev/null
    set -a
    source "${PROJECT_DIR}/.env.local"
    set +a
    if [[ -n "$DATABASE_URL" ]]; then
      PG_CONNECTION="DATABASE_URL=$DATABASE_URL"
    else
      echo "WARNING: DATABASE_URL not found in .env.local" >&2
      exit 1
    fi
  else
    echo "ERROR: DATABASE_URL not set and .env.local not found" >&2
    exit 1
  fi
fi

# Generate timestamp for backup filename
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/cencom_${TIMESTAMP}.sql"

echo "Starting backup of cencom database..."
echo "Backup file: $BACKUP_FILE"

# Perform pg_dump
pg_dump ${PG_CONNECTION} -F c -b -F -v -f "$BACKUP_FILE" 2>/dev/null || {
  # Try plain format if custom fails
  pg_dump ${PG_CONNECTION} -F t -f "$BACKUP_FILE" 2>/dev/null || {
    # Try plain SQL format
    pg_dump ${PG_CONNECTION} > "$BACKUP_FILE" 2>/dev/null || {
      echo "ERROR: pg_dump failed" >&2
      exit 1
    }
  }
}

echo "Backup completed: $BACKUP_FILE"

# Keep only 7 most recent backups, remove older ones
# List backups sorted by timestamp (filename format: cencom_YYYYMMDD_HHMMSS.sql)
OLD_BACKUPS=$(ls -1t "${BACKUP_DIR}/cencom_"*.sql 2>/dev/null | tail -n +8)

if [[ -n "$OLD_BACKUPS" ]]; then
  echo "Removing backups older than 7 days..."
  echo "$OLD_BACKUPS" | while read -r oldBackup; do
    rm -f "$oldBackup"
    echo "  Removed: $(basename "$oldBackup")"
  done
fi

echo "Backup retention: keeping last 7 backups in $BACKUP_DIR"
exit 0