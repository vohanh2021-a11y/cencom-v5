# Tài liệu Giám sát & Rollback On-Premise (GPS GĐ3)

> Áp dụng cho: CencomOS Gara v5.0 triển khai on-premise qua
> `Onpremise/docker-compose.yml` + `Onpremise/Dockerfile.standalone` + `Onpremise/nginx/nginx.conf`.
> Mục đích: Hướng dẫn vận hành (monitoring) và phục hồi (rollback/disaster recovery)
> khi deploy hỏng hoặc nâng cấp gặp lỗi.

---

## 0. TỔNG QUAN STACK (tên thực tế đã verify)

| Thành phần | Service / Container | Image | Port ngoài |
|---|---|---|---|
| Next.js app | `cencom-web` | build từ `Dockerfile.standalone` (node:22-alpine) | (chỉ nội bộ 3000) |
| Nginx reverse proxy | `cencom-nginx` | `nginx:1.25-alpine` | 80 → 443 (HTTPS) |
| PostgreSQL | `supabase-db` | `supabase/postgres:15.8.1.085` | 54322 (host) / 5432 (nội bộ) |
| Backup DB | script | `Onpremise/scripts/backup.sh` | — |
| Restore DB | script | `Onpremise/scripts/restore.sh` | — |

- **Health endpoint**: `GET /api/health` trả về `ok` (được Dockerfile HEALTHCHECK và Nginx location `/api/health` sử dụng).
- **Database name**: `cencom_os` (biến `$DB_NAME`, mặc định trong compose/scripts).
- **Volume DB**: `./volumes/pg_data` (bind mount) — **không xóa khi rollback**.

---

## 1. HEALTH CHECK (giám sát app sống)

### 1.1 Nhanh — qua Nginx (user-facing)
```bash
# HTTPS self-signed → -k (bỏ qua cảnh báo cert)
curl -k https://localhost/api/health
# Kỳ vọng in ra: ok
```

### 1.2 Trực tiếp app (bỏ qua Nginx)
```bash
curl http://localhost:3000/api/health
```

### 1.3 Script tự động (cron / monitoring)
```bash
bash Onpremise/scripts/healthcheck.sh
# Exit 0 = HEALTHY, Exit 1 = UNHEALTHY (dùng được trong cron gửi cảnh báo)
```
Có thể override URL/container:
```bash
HEALTH_URL=https://192.168.0.100/api/health APP_CONTAINER=cencom-web \
  bash Onpremise/scripts/healthcheck.sh
```

### 1.4 Trạng thái container & Docker healthcheck
```bash
docker compose ps                 # trạng thái các service
docker inspect -f '{{.State.Health.Status}}' cencom-web   # healthy/unhealthy
```

### 1.5 Log — xem ở đâu
```bash
docker compose logs -f cencom-web      # log ứng dụng Next.js
docker compose logs -f cencom-nginx    # access/error log nginx (/var/log/nginx/)
docker compose logs -f supabase-db     # log PostgreSQL
# Chỉ 1 service cụ thể, đuôi 100 dòng:
docker compose logs --tail=100 -f cencom-web
```
> Lưu ý: README cũ ghi `docker compose logs -f app` — thực tế container tên là **`cencom-web`**, dùng tên này cho chính xác.

### 1.6 Metrics cơ bản
```bash
docker stats            # CPU / Memory / Net theo thời gian thực
```

---

## 2. ROLLBACK (khi deploy hỏng)

### 2.1 Nguyên tắc
- **Giữ nguyên data**: KHÔNG chạy `docker compose down -v` (sẽ mất volume `pg_data`).
- Rollback = quay lại **image cũ** của `cencom-web` + (nếu cần) **restore DB** từ backup gần nhất.
- Luôn verify lại bằng health check sau khi rollback.

### 2.2 Quy trình chuẩn

**Bước 1 — Dừng stack (giữ volume):**
```bash
cd Onpremise
docker compose down          # KHÔNG dùng -v
```

**Bước 2 — Quay lại image cũ (tag đã lưu):**
Khi build, luôn tag image theo version, ví dụ:
```bash
docker build -f Onpremise/Dockerfile.standalone -t cencom-web:1.2.3 ..
docker tag cencom-web:1.2.3 cencom-web:stable     # giữ bản ổn định
```
Rollback: sửa `image:` của service `cencom-web` trong `docker-compose.yml`
thành tag cũ (vd `cencom-web:1.2.2`), rồi:
```bash
docker compose up -d
```

**Bước 3 — (Tùy chọn) Restore DB từ backup gần nhất:**
```bash
# Xem các bản backup (mặc định /var/backups/cencom, giữ 30 ngày)
ls -t /var/backups/cencom/cencom_*.sql.gz | head -5

# Restore (script sẽ hỏi xác nhận y/N):
bash Onpremise/scripts/restore.sh /var/backups/cencom/cencom_YYYY-MM-DD_HH-MM-SS.sql.gz

# Hoặc tự động không hỏi (dùng trong script):
echo y | bash Onpremise/scripts/restore.sh <file.sql.gz>
```
> `restore.sh` ghi đè DB `cencom_os` trong container `supabase-db`. Chỉ restore khi
> thực sự cần quay lại trạng thái data cũ (deploy lỗi làm hỏng schema/data).

**Bước 4 — Verify:**
```bash
sleep 15
curl -k https://localhost/api/health      # kỳ vọng: ok
docker compose ps
```

### 2.3 Rollback chỉ riêng app (DB không đổi)
Nếu lỗi chỉ nằm ở code app (không đổi schema), bỏ qua Bước 3 — chỉ cần
đổi image tag cũ và `docker compose up -d`.

---

## 3. BACKUP ĐỊNH KỲ (phòng thể phục hồi)

Script: `Onpremise/scripts/backup.sh` (pg_dump → `<BACKUP_DIR>/cencom_<date>.sql.gz`,
giữ 30 ngày; đọc `$DB_NAME/$DB_USER/$DB_CONTAINER` từ `../.env`, mặc định
`cencom_os` / `postgres` / `supabase-db`).

**Cấu hình cron (trên server Ubuntu):**
```bash
sudo crontab -e
# Thêm dòng (backup 2h sáng mỗi ngày, ghi log):
0 2 * * * bash /opt/cencom/Onpremise/scripts/backup.sh >> /var/backups/cencom/cron.log 2>&1
```
> README cũ ghi `scripts/backup/pg_backup.sh` — thực tế file là **`scripts/backup.sh`**,
> hãy dùng đúng đường dẫn này.

**Kiểm tra backup định kỳ (thủ công):**
```bash
bash Onpremise/scripts/backup.sh
ls -lh /var/backups/cencom/
```

---

## 4. NÂNG CẤP NEXT.JS 14 → 16 (đã ghi nhận 21 CVE)

Việc nâng cấp framework chứa bản sửa 21 CVE bảo mật, nhưng là **breaking change**
giữa v14 → v15 → v16 (Async Request APIs, caching mặc định thay đổi, v.v.).
BẮT BUỘC test regression trước khi lên prod.

### 4.1 Quy trình nâng cấp an toàn
1. Sửa `next` (và `eslint-config-next` nếu dùng) trong `gara_reconstruction_v5/package.json`.
2. `cd gara_reconstruction_v5 && npm install` (hoặc `npm ci` sau khi cập nhật lockfile).
3. **Chạy gate CI cục bộ** (hoặc để GitHub Actions chạy):
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run test:conformance      # kỳ vọng ≥ 289 tests xanh
   npm run build
   ```
4. Deploy lên môi trường **staging / LAN test** trước, chạy smoke + health check.
5. Mới đẩy lên **production** trong giờ thấp điểm, kèm sẵn bản image cũ để rollback (§2).

### 4.2 Rủi ro khi nâng cấp
- Thay đổi hành vi caching/middleware giữa major version → cần đọc changelog v15, v16.
- Nếu CI đỏ ở bước nào → **không deploy**, fix tại nhánh develop rồi mới merge.
- Luôn giữ tag image cũ (`cencom-web:<version-cu>`) trước khi build bản mới.

---

## 5. CHECKLIST VẬN HÀNH HÀNG NGÀY

- [ ] `bash Onpremise/scripts/healthcheck.sh` → HEALTHY.
- [ ] `docker compose logs -f cencom-web` không có lỗi nghiêm trọng.
- [ ] Backup đêm qua có file mới trong `/var/backups/cencom/`.
- [ ] Disk volume `./volumes/pg_data` chưa đầy.
- [ ] Khi deploy: build xong phải tag image version + giữ bản cũ để rollback.

---

> **⚠️ Lưu ý hệ thống sản xuất (Production Check):**
> - **Con thiếu gì?** Chưa có alert tự động khi healthcheck trả UNHEALTHY (cron chỉ chạy script,
>   cần thêm bước gửi mail/Slack). Chưa có Prometheus/Grafana (chỉ `docker stats` thủ công).
> - **Rủi ro ở đâu?** Rollback sai (dùng `down -v` mất data); restore DB ghi đè nhầm bản backup;
>   nâng Next.js 14→16 mà chưa test regression có thể gãy middleware/caching.
> - **Đã chạy test chưa?** Tài liệu này là hướng dẫn vận hành; các lệnh đã verify khớp với
>   `docker-compose.yml`, `Dockerfile.standalone`, `nginx.conf`, `backup.sh`, `restore.sh` thực tế.
>   CI gate (tsc/lint/conformance/build) nằm ở `gara_reconstruction_v5/.github/workflows/ci.yml`.
> - **Đề xuất tiếp theo?** Thêm script cron gọi `healthcheck.sh` + gửi cảnh báo; thêm job
>   restore-test định kỳ (restore bản backup vào DB tạm để xác nhận backup hợp lệ).
