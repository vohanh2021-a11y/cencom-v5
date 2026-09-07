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

## Backup hàng ngày (cron) — đã verify 07/09/2026 (dump → restore khớp 42 xe/6 users)

Trên server Ubuntu, thêm crontab:
```bash
crontab -e
# Thêm (giữ 30 ngày, log cron):
0 2 * * * cd /opt/cencom/Onpremise && bash scripts/backup.sh >> /opt/cencom/Onpremise/backup/cron.log 2>&1
```
Kiểm chứng restore (bắt buộc sau lần backup đầu trên máy mới):
```bash
docker exec cencom_v5_db psql -U postgres -c "CREATE DATABASE cencom_restore_test;"
gunzip -c backup/cencom_<date>.sql.gz | docker exec -i cencom_v5_db psql -U postgres -d cencom_restore_test --quiet
docker exec cencom_v5_db psql -U postgres -d cencom_restore_test -tAc "SELECT COUNT(*) FROM xe"
# phải khớp COUNT trên DB gốc, xong: DROP DATABASE cencom_restore_test
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
