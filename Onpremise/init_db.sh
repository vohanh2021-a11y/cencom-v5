#!/bin/bash
# init_db.sh — Initialize CencomOS Gara v5 database
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
V5_DIR="$PROJECT_DIR/gara_reconstruction_v5"

echo "=== CencomOS Gara v5 — Database Init ==="

# Check if docker compose is running
if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps db | grep -q "Up"; then
  echo "Starting database..."
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d db
  sleep 5
fi

# Run migrations
echo "Running migrations..."
cd "$V5_DIR"
npx tsx db/migrate.ts

# Seed data
echo "Seeding data..."
npx tsx db/seed.ts

# Apply realtime triggers
echo "Applying realtime triggers..."
PGPASSWORD=postgres psql -h localhost -U postgres -d cencom -f db/realtime_triggers.sql 2>/dev/null || true

echo "=== Database initialized successfully ==="
