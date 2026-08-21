# DEPLOY.md — Hướng dẫn triển khai cencomOS Gara v5

> **Phiên bản:** v5.0.0 | **Ngày:** 2026-08-21
> **Áp dụng:** cencomOS Gara v5 (`gara_reconstruction_v5`)

---

## 0. Yêu cầu tiên quyết

| Thành phần | On-Premise | Cloud (Vercel) |
|---|---|---|
| Node.js | ≥ 18.x | Managed (Vercel) |
| PostgreSQL | ≥ 16 (Docker hoặc host) | Supabase / Neon /managed |
| Docker | ≥ 24.x + Compose v2 | Không cần |
| Git | ≥ 2.40 | Managed |

---

## 1. Git Tag Strategy — `v5.x.x`

Sử dụng [Semantic Versioning](https://semver.org/):

```
v5.<MAJOR>.<MINOR>
```

| Loại | Khi nào | Ví dụ |
|---|---|---|
| `v5.x.0` | Release major (tính năng mới lớn) | `v5.0.0`, `v5.1.0` |
| `v5.x.x` | Bug fix / patch nhỏ | `v5.0.1`, `v5.1.2` |

**Quy tắc tag:**
```bash
# Tag release
git tag -a v5.0.0 -m "Release v5.0.0: initial production deploy"
git push origin v5.0.0

# Xem danh sách tag
git tag -l "v5.*"

# Rollback về tag
bash scripts/rollback.sh v5.0.0
```

---

## 2. Deploy On-Premise (Docker Compose)

### 2.1 Setup lần đầu

```bash
cd gara_reconstruction_v5

# 1. Clone repo (nếu chưa)
git clone <repo-url> .
git checkout v5.0.0  # hoặc tag mong muốn

# 2. Cấu hình env
cp .env.example .env
# Chỉnh sửa DATABASE_URL, SESSION_SECRET
# SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Build image
docker compose build

# 4. Khởi chạy
docker compose up -d

# 5. Init DB (lần đầu)
docker compose exec web npx tsx db/migrate.ts
docker compose exec web npx tsx db/seed.ts
docker compose exec web psql -U postgres -d cencom -f db/realtime_triggers.sql

# 6. Kiểm tra
docker compose ps
curl http://localhost:3001/api/health
# → {"ok": true}
```

### 2.2 Rollback

```bash
# Backup trước khi rollback
bash scripts/rollback.sh v5.0.0

# Rollback code + DB
bash scripts/rollback.sh v5.0.0

# Rollback code-only
bash scripts/rollback.sh v5.0.0 --code-only

# Sau rollback: rebuild nếu cần
docker compose build
docker compose up -d
```

### 2.3 Backup & Restore

```bash
# Tạo backup
bash scripts/backup.sh
# → backups/cencom_20260821_143000.sql

# Restore từ backup (thủ công)
pg_restore -U postgres -d cencom backups/cencom_20260821_143000.sql

# Cron backup hàng ngày (02:00 AM)
echo "0 2 * * * cd $(pwd) && bash scripts/backup.sh" | crontab -
```

---

## 3. Deploy Cloud (Vercel)

### 3.1 Setup

```bash
# 1. Import repo vào Vercel Dashboard
# 2. Set Environment Variables:
#    DATABASE_URL=postgresql://user:pass@host:5432/cencom
#    SESSION_SECRET=<random-32-chars>
#    PORT=3000
# 3. Deploy (tự động từ git push)
```

### 3.2 Deploy theo tag

```bash
# Push tag → Vercel tự trigger deploy
git tag v5.0.0
git push origin v5.0.0

# Hoặc manually promote trong Vercel Dashboard:
# Deployments →⋯→ Promote to Production
```

### 3.3 Rollback trên Vercel

```bash
# Option 1: Promote deployment cũ
# Dashboard → Deployments → tìm deployment trước →⋯→ Promote to Production

# Option 2: Rollback DB
bash scripts/rollback.sh v5.0.0 --db-only
```

---

## 4. Monitoring

### 4.1 Health Check

```bash
# HTTP endpoint
curl http://localhost:3001/api/health
# → {"ok": true, "db": "connected", "uptime": 12345}

# Script check
bash scripts/health_check.sh
```

### 4.2 Metrics (Prometheus)

```bash
curl http://localhost:3001/api/metrics
# → # HELP http_requests_total ...
# → # HELP http_request_duration_seconds ...
```

### 4.3 Docker Healthcheck

Trong `docker-compose.yml`:
```yaml
services:
  web:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

### 4.4 Logs

```bash
# Docker logs
docker compose logs -f web
docker compose logs -f postgres

# PM2 logs (nếu dùng PM2)
pm2 logs gara-app
```

---

## 5. Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| Build fail | `npx tsc --noEmit` trước; sửa lỗi TS rồi `npm run build` |
| DB connect fail | Kiểm tra `DATABASE_URL`, postgres container đang chạy |
| Health check fail | `curl localhost:3001/api/health`; xem log app |
| Port conflict | Đổi `PORT` trong `.env` hoặc `docker-compose.yml` |
| Rollback fail | Kiểm tra git tag tồn tại; backup file trong `backups/` |

---

> **⚠️ Lưu ý hệ thống sản xuất (Production Check)**
> 1. **Con thieu gi?** — Kiểm tra `.env` đã set đủ `DATABASE_URL`, `SESSION_SECRET`; DB đã migrate.
> 2. **Rui ro o dau?** — Self-signed cert gây cảnh báo trình duyệt; DB container restart mất data nếu không mount volume.
> 3. **Da chay test chua?** — `npm run test:ci` >= 236/236, `npm run e2e` pass, `npm run build` thành công.
> 4. **De xuat tiep theo?** — Deploy trên staging trước khi production; setup cron backup; monitor health endpoint.
