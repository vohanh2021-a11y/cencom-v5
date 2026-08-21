#!/bin/bash
# === install_cert_linux.sh — Cài đặt SSL cert vào CA bundle (Linux) ===
# Chạy với quyền sudo:  sudo bash install_cert_linux.sh
#
set -e

CERT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_FILE="$CERT_DIR/server.crt"

# Kiểm tra quyền root
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] Chạy với sudo: sudo bash $0"
    exit 1
fi

if [ ! -f "$CERT_FILE" ]; then
    echo "[ERROR] Không tìm thấy server.crt trong $CERT_DIR"
    exit 1
fi

echo "=== Cài đặt SSL cert vào Trusted CA (Linux) ==="
echo "  Cert: $CERT_FILE"

# Ubuntu/Debian
if [ -d /usr/local/share/ca-certificates ]; then
    cp "$CERT_FILE" /usr/local/share/ca-certificates/cencom-lan.crt
    update-ca-certificates
    echo "[OK] Đã cài đặt (Ubuntu/Debian)"
# RHEL/CentOS/Fedora
elif [ -d /etc/pki/ca-trust/source/anchors ]; then
    cp "$CERT_FILE" /etc/pki/ca-trust/source/anchors/cencom-lan.crt
    update-ca-trust
    echo "[OK] Đã cài đặt (RHEL/CentOS/Fedora)"
else
    echo "[WARN] Hệ điều hành không được hỗ trợ tự động."
    echo "  Hãy thêm server.crt vào CA bundle của hệ thống."
    exit 1
fi

echo ""
echo "=== Hoàn tất ==="
echo "  Truy cập: https://192.168.0.72"
echo "  Hoặc:     https://cencom.lan (cần thêm hosts entry)"
echo ""
echo "  Thêm hosts entry (nếu chưa có):"
echo "    echo '192.168.0.72 cencom.lan' >> /etc/hosts"
