# Cài đặt thực thi on-premise (Intranet / LAN)

## Quick Start (local dev machine)

```bash
# 1. Tạo certs
cd Onpremise
bash scripts/init_certs.sh

# 2. Copy env + setup
cp .env.onpremise .env.onpremise.local
# Mở .env.onpremise.local, sinh SESSION_SECRET bằng:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Build + run
bash scripts/deploy_local.sh

# 4. Init DB (1 lần đầu)
bash scripts/init_db.sh
```

Truy cập: `https://localhost` (cảnh báo self-signed, click "Advanced" → "Proceed")

---

## Deploy trên Ubuntu Server

```bash
# Trên server: cài Docker
sudo apt update && sudo apt install -y docker.io docker-compose

# Từ máy dev:
SERVER_IP=192.168.0.100 bash scripts/deploy_server.sh
```

---

## Thêm self-signed cert vào tin cậy (bỏ cảnh báo browser)

**Windows**: `mmc.exe` → Add/Remove Snap-in → Certificates → Trusted Root Certification Authorities → Import `nginx/certs/server.crt`

**Linux**: 
```bash
sudo cp nginx/certs/server.crt /usr/local/share/ca-certificates/cencom.crt
sudo update-ca-certificates
```

**Mac**:
```bash
sudo security add-trusted-cert -d -r -k /Library/Keychains/System.keychain nginx/certs/server.crt
```

---

## Backup hàng ngày (cron)

Trên server, thêm crontab:
```bash
crontab -e
# Thêm:
0 2 * * * /opt/cencom/Onpremise/scripts/backup/pg_backup.sh >> /opt/cencom/Onpremise/backups/cron.log 2>&1
```

---

## Firewall (LAN-only)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 443
sudo ufw allow from 192.168.0.0/16 to any port 80
sudo ufw allow 5432 from localhost
sudo ufw enable
```

---

## Troubleshooting

| Vấn đề | Cách khắc phục |
|---|---|
| `server.crt: Permission denied` | `chmod 755 Onpremise/nginx/certs` |
| `Connection refused: PostgreSQL` | `docker-compose logs supabase-db` |
| `WebSocket handshake 404` | Kiểm tra Nginx `location /realtime` proxy |
| `pg_dump: command not found` | Dùng `docker exec -i supabase-db pg_dump` |
| `cert not trusted` | Thêm cert vào Trusted Root CA (xem trên) |
