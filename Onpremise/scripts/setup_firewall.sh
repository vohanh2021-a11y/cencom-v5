#!/bin/bash
# =============================================================================
# setup_firewall.sh — Cấu hình UFW cho Ubuntu Server (LAN-only)
# Chạy với quyền root: sudo bash setup_firewall.sh
# =============================================================================

set -e

# Dải mạng LAN công ty (sửa theo thực tế)
LAN_CIDR="192.168.0.0/16"

echo "=== Cấu hình UFW cho CencomOS-Gara (LAN-only) ==="
echo "LAN CIDR: $LAN_CIDR"

# Reset UFW (cẩn thận: xóa rules cũ)
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (quản trị từ LAN)
ufw allow from $LAN_CIDR to any port 22 comment 'SSH from LAN'

# Allow HTTPS (Nginx proxy)
ufw allow from $LAN_CIDR to any port 443 comment 'HTTPS (CencomOS)'

# Allow HTTP (redirect to HTTPS)
ufw allow from $LAN_CIDR to any port 80 comment 'HTTP redirect'

# PostgreSQL CHỈ localhost (Docker internal network)
# KHÔNG expose 5432 ra LAN

# Realtime WS / Storage API CHỈ internal (Docker network)
# KHÔNG expose 54324, 54325 ra LAN

# Enable UFW
ufw --force enable

echo ""
echo "=== UFW Status ==="
ufw status numbered

echo ""
echo "=== Hoàn tất ==="
echo "Chỉ cho phép truy cập từ $LAN_CIDR:"
echo "  - SSH (22)"
echo "  - HTTP (80) -> redirect HTTPS"
echo "  - HTTPS (443) -> Nginx -> CencomOS"
echo ""
echo "PostgreSQL (5432), Realtime (54324), Storage (54325) KHÔNG expose ra LAN."