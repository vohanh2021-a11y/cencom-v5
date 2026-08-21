# Production Deployment Guide — cencomOS Gara v5

> **Bước 1: Thiết lập biến môi trường**
> Sao chép file `.env.production.example` thành `.env.production` và điền giá trị thực:
> ```bash
> cp .env.production.example .env.production
> ```
> Cài đặt các biến:
> - `DATABASE_URL`: Chuỗi kết nối PostgreSQL (format: `postgres://user:password@host:5432/cencom`)
> - `SESSION_SECRET`: Chìa kýóa ngẫu nhiên (≥ 32 ký tự). Sinh qua `openssl rand -hex 32`
> - `PORT`: Cổng chạy ứng dụng (mặc định `3000`)

> **Bước 2: Chạy migration & seed**
> Sử dụng scripts trong `packages/db`:
> ```bash
> # Chạy migration (tạo schema)
> npm run migrate
>
> # Seed dữ liệu ban đầu (dữ liệu mẫu, cánh cửa test)
> npm run seed
> ```
> *Lưu ý: Migration sử dụng pool kết nối từ `.env.production`. Kiểm tra `DATABASE_URL` trước khi chạy.*

> **Bước 3: Build ứng dụng**
> ```bash
> npm run build
> ```
> *Lệnh này sẽ tạo ra các file static và `.next/` bundle cho production.*
> *Kiểm tra `npx tsc --noEmit` = 0 lỗi trước khi build.*

> **Bước 3b: Build Docker (On-Premise/LAN)**
> ```bash
> # Build image v5
> docker compose build
>
> # Hoặc build standalone (nếu next.config đã bật output:'standalone')
> docker build -t cencom-gara-v5 .
> ```
> *Dockerfile multi-stage: build → copy standalone output vào runtime image slim.*
> *Yêu cầu: `output: 'standalone'` trong `next.config.js`. Xem `DEPLOY.md` chi tiết.*

> **Bước 4: Khởi chạy production**
> **Lựa chọn A — Next.js native:**
> ```bash
> npm start
> ```
> Hoặc chỉ định cổng:
> ```bash
> PORT=3000 npm start
> ```

> **Lựa chọn B — PM2 (Khuyến nghị cho production):**
> ```bash
> # Biến môi trường đã được cài trong .env.production
> pm2 start npm --name "gara-app" -- start
> # hoặc chạy directly:
> pm2 start "next start" --name "gara-app" --env .env.production
> ```

> **Lựa chọn C — Docker (On-Premise/LAN):**
> ```bash
> # Khởi chạy tất cả service (app + postgres)
> docker compose up -d
>
> # Kiểm tra trạng thái
> docker compose ps
> docker compose logs -f web
> ```
> *Xem `DEPLOY.md` cho hướng dẫn đầy đủ.*

> **Bước 5: Rollback (khôi phục)**
> **Rollback code (Git tag):**
> ```bash
> # Khôi phục về tag cụ thể
> bash scripts/rollback.sh v5.0.0
>
> # Hoặc rollback code-only (giữ nguyên DB)
> bash scripts/rollback.sh v5.0.0 --code-only
>
> # Hoặc rollback DB-only (giữ nguyên code)
> bash scripts/rollback.sh v5.0.0 --db-only
> ```
> *Script tự động: backup DB trước khi rollback → checkout git tag → restore DB từ backup.*
> *Sau rollback: chạy `npm install && npm run build` (nếu rollback code).*

> **Rollback thủ công (không dùng script):**
> ```bash
> # Code
> git checkout v5.0.0
> npm install && npm run build
>
> # DB
> pg_restore -U user -d cencom backup_2026_08_21.sql
> ```

> **Bước 6: Monitoring**
> **Health Check:**
> ```bash
> # HTTP endpoint
> curl http://localhost:3001/api/health
> # → {"ok": true, "db": "connected", "uptime": 12345}
>
> # Hoặc dùng script
> bash scripts/health_check.sh
> ```
>
> **Metrics (Prometheus format):**
> ```bash
> curl http://localhost:3001/api/metrics
> # → # HELP http_requests_total ...
> ```
>
> **Docker healthcheck** đã cấu hình trong `docker-compose.yml`:
> ```yaml
> healthcheck:
>   test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
>   interval: 30s
>   timeout: 5s
>   retries: 3
> ```

> **⚠️ Lưu ý hệ thống sản xuất (Production Check)**
> 1. **Con thiếu gi?** — Kiểm tra `DATABASE_URL` có đúng chưa, `SESSION_SECRET` đã set chứ không phải placeholder.
> 2. **Rủi ro đầu?** — Xác thực input qua Zod validation, không nối chuỗi SQL, escape output HTML.
> 3. **Chay test chua?** — Chạy `npm run test:ci` >= 236/236, `npm run e2e` pass.
> 4. **De xuat tiep theo?** — Theo dõi `npm audit`, cập nhật dependency, giám sát log `pg_audit` nếu enable.

> **Cau hinh NGINX (neu deploy tren VM/On-Premise):**
> ```nginx
> server {
>     listen 80;
>     server_name your-domain.com;
>
>     location / {
>         proxy_pass http://localhost:3000;
>         proxy_http_version 1.1;
>         proxy_set_header Upgrade $http_upgrade;
>         proxy_set_header Connection "upgrade";
>         proxy_set_header Host $host;
>     }
>
>     # WebSocket support cho realtime features
>     location /ws/ {
>         proxy_pass http://localhost:3000;
>         proxy_http_version 1.1;
>         proxy_set_header Upgrade $http_upgrade;
>         proxy_set_header Connection "upgrade";
>     }
> }
> ```
