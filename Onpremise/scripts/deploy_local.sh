#!/bin/bash
# === deploy_local.sh — Build + chạy stack trên máy phát triển (Docker Desktop) ===
# Dùng để test local trước khi deploy lên server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== [1/4] Tạo certs (nếu chưa có) ==="
if [ ! -f ../nginx/certs/server.crt ]; then
    echo "Tạo self-signed certificate..."
    bash init_certs.sh
else
    echo "Cert đã tồn tại, bỏ qua."
fi

echo "=== [2/4] Build Docker images ==="
# Docker Compose V2 (docker compose) compatible with Docker Desktop >= 3.6
# Falls back to legacy v1 (docker-compose) if V2 not available
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "[ERROR] Neither 'docker compose' nor 'docker-compose' found."; exit 1
fi
$COMPOSE_CMD build

echo "=== [3/4] Khởi động stack ==="
$COMPOSE_CMD up -d

echo "=== [4/4] Chờ services khởi động (30s) ==="
sleep 30

echo ""
echo "=== Kiểm tra trạng thái ==="
$COMPOSE_CMD ps

echo ""
echo "=== Truy cập ==="
echo "  Next.js trực tiếp:  http://localhost:3000"
echo "  Qua Nginx (HTTPS):  https://localhost"
echo "  Health check:       https://localhost/healthz"
echo "  API:                https://localhost/api/health"
echo "  Realtime (WS):      wss://localhost/realtime"

echo ""
echo "=== Khởi động hoàn tất ==="
echo "Để init DB (chạy 1 lần đầu): bash scripts/init_db.sh"
echo "Để dừng: docker-compose down"
