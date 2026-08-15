#!/bin/bash
# === deploy_server.sh — Deploy trên Ubuntu Server (production) ===
# Chạy từ máy dev, deploy qua SSH tới server
# Yêu cầu: SSH key đã copy tới server, Docker đã cài trên server

set -e

# Cấu hình server — sửa tại đây hoặc truyền biến môi trường
SERVER_IP=${SERVER_IP:-192.168.0.100}
DEPLOY_USER=${DEPLOY_USER:-cencom}
DEPLOY_DIR=${DEPLOY_DIR:-/opt/cencom}
PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV_FILE=${ENV_FILE:-$PROJECT_ROOT/Onpremise/.env.onpremise.local}

echo "=== Deploy tới server: $SERVER_IP ==="

# Kiểm tra SSH
echo "=== [1/6] Kiểm tra SSH ==="
ssh -o ConnectTimeout=10 -o BatchMode=yes $DEPLOY_USER@$SERVER_IP "echo 'SSH OK'" 2>/dev/null || {
    echo "ERROR: Không thể SSH tới $SERVER_IP"
    echo "Kiểm tra: ssh $DEPLOY_USER@$SERVER_IP"
    exit 1
}
echo "SSH kết nối OK"

# Kiểm tra Docker trên server
echo "=== [2/6] Kiểm tra Docker trên server ==="
ssh $DEPLOY_USER@$SERVER_IP "docker --version && docker-compose --version" \
    || { echo "ERROR: Docker chưa cài trên server"; exit 1; }

# Chuẩn bị môi trường
echo "=== [3/6] Tạo thư mục trên server ==="
ssh $DEPLOY_USER@$SERVER_IP "
    mkdir -p $DEPLOY_DIR/Onpremise/nginx/certs
    mkdir -p $DEPLOY_DIR/Onpremise/volumes/pg_data
    mkdir -p $DEPLOY_DIR/Onpremise/volumes/storage_data
"

# Build Docker image local
echo "=== [4/6] Build Docker image ==="
cd "$PROJECT_ROOT"
docker build -f Onpremise/Dockerfile.standalone -t cencom-web:latest .

# Export image
IMAGE_TAR="/tmp/cencom-web-$(date +%Y%m%d-%H%M%S).tar"
echo "=== [5/6] Export image → $IMAGE_TAR ==="
docker save cencom-web:latest -o "$IMAGE_TAR"

# Copy files lên server
echo "=== [6/6] Copy files lên server ==="
# Image
scp "$IMAGE_TAR" $DEPLOY_USER@$SERVER_IP:/tmp/cencom-web-latest.tar
# Env
if [ -f "$ENV_FILE" ]; then
    scp "$ENV_FILE" $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/Onpremise/.env.onpremise
else
    scp Onpremise/.env.onpremise $DEPLOY_USER@$DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/Onpremise/.env.onpremise
fi
# Docker compose
scp Onpremise/docker-compose.yml $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/Onpremise/
# Nginx config
scp -r Onpremise/nginx/nginx.conf $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/Onpremise/nginx/
# Scripts
scp -r Onpremise/scripts/ $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/Onpremise/scripts/
# Supabase migrations
mkdir -p /tmp/_cencom_migrations
cp -r supabase/migrations /tmp/_cencom_migrations/
scp -r /tmp/_cencom_migrations/migrations $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/supabase/

# Deploy trên server
echo ""
echo "=== Deploy trên server ==="
ssh $DEPLOY_USER@$SERVER_IP << 'REMOTE_SCRIPT'
set -e
cd $DEPLOY_DIR/Onpremise

# Load image
docker load < /tmp/cencom-web-latest.tar

# Stop stack cũ
docker-compose down

# Pull Supabase images (nhanh hơn nếu đã có cache)
docker-compose pull

# Start stack
docker-compose up -d

# Health check
echo "Đợi services khởi động..."
sleep 30
docker-compose ps

# Init DB nếu chưa có
DB_READY=$(docker exec -i supabase-db psql -U postgres -d cencom_os -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ')
if [ "$DB_READY" -lt 20 ]; then
    echo "Khởi tạo DB..."
    bash scripts/init_db.sh
fi

echo "=== Deploy hoàn tất! ==="
echo "Truy cập: https://$SERVER_IP"
REMOTE_SCRIPT

# Dọn tạm thời
rm -f "$IMAGE_TAR"
ssh $DEPLOY_USER@$SERVER_IP "rm -f /tmp/cencom-web-latest.tar"

echo ""
echo "=== Deployment completed! ==="
