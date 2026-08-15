#!/bin/bash
# === init_certs.sh — Sinh self-signed SSL certificate cho on-premise ===
# Chạy TRƯỚC lần đầu deploy để tạo cert

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/nginx/certs"

echo "=== Sinh self-signed SSL certificate ==="

mkdir -p "$CERTS_DIR"

# Sinh cert dùng openssl
# CN=domin công ty LAN (có thể thay đổi bằng IP hoặc hostname)
DOMAIN=${1:-cencom.lan}
IP=${2:-192.168.0.100}

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=VN/ST=HoChiMinh/O=CencomOS/OU=IT Department/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:cencom.local,IP:$IP"

chmod 600 "$CERTS_DIR/server.key"
chmod 644 "$CERTS_DIR/server.crt"

echo ""
echo "=== Certificate tạo xong tại: $CERTS_DIR ==="
echo "  server.crt  → Public cert (thêm vào Trusted Root trên máy user)"
echo "  server.key  → Private key (GIỮ BÍ MẬT, không phân phối)"
echo ""
echo "=== Hướng dẫn thêm cert vào Trusted Root CA ==="
echo "Windows: mmc.exe → Add/Remove Snap-in → Certificates → Trusted Root CA → Import server.crt"
echo "Linux:   sudo cp server.crt /usr/local/share/ca-certificates/cencom.crt && sudo update-ca-certificates"
echo "Mac:     sudo security add-trusted-cert -d -r -k /Library/Keychains/System.keychain server.crt"
