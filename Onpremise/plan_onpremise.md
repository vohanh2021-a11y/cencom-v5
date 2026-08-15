# PLAN ON-PREMISE — CencomOS-Gara 4.0 (Intranet / LAN Self-Hosted)

> Phiên bản: 2026-08-14 · Tác giả: Gatekeeper
> Mục đích: Hướng dẫn chi tiết triển khai toàn bộ hệ thống CencomOS-Gara v4.0 **on-premise** (Intranet/LAN) bằng Docker trên Ubuntu Server, thay thế kế hoạch cloud (Vercel + Supabase managed).
> Áp dụng cho: Môi trường công ty muốn dữ liệu không lọt ra ngoài internet, dùng trình duyệt nội bộ.

---

## 0. TÓM TẮT MỘT CÂU

Triển khai **toàn bộ stack** CencomOS-Gara v4.0 (Next.js + PostgreSQL + Realtime + Storage + Custom Auth) trong mạng LAN công ty bằng **Docker Compose** trên Ubuntu Server, dùng **self-signed SSL certificate**, giới hạn truy cập nội bộ, sẵn sàng mở rộng thành multi-tenant trong tương lai, **có thể chuyển sang cloud (Vercel + Supabase) mà không thay đổi code business logic**.

---

## 1. SO SÁNH ARCHITECTURE: CLOUD vs ON-PREMISE

| Thành phần | Cloud (Vercel + Supabase managed) | On-Premise (Docker trên Ubuntu) |
|---|---|---|
| **Next.js** | Deploy trên Vercel | Docker standalone (node:alpine) + Nginx reverse proxy |
| **PostgreSQL** | Supabase managed | Self-hosted PostgreSQL 15 (trong Docker) |
| **Realtime (WS)** | Supabase Realtime | Supabase Realtime self-hosted (WebSocket trong Docker) |
| **Storage** | Supabase Storage (cloud) | Supabase Storage self-hosted (filesystem local) |
| **Auth** | Custom `packages/core` | Custom `packages/core` — **KHÔNG ĐỔI** |
| **API Contract** | `POST /api/rpc {fn,args}` | `POST /api/rpc {fn,args}` — **GIỮ NGUYÊN** |
| **SSL** | Vercel tự quản (Let's Encrypt) | Self-signed cert + Nginx |
| **CI/CD** | GitHub Actions → Vercel | Build Docker image locally → deploy bằng script |
| **Network** | Public internet | LAN-only (firewall chặn Internet inbound) |

**=> Core business logic (`packages/core`, `packages/db/schema.sql`) không thay đổi gì. Chỉ thay đổi:**
- Environment variables (`.env`)
- Infrastructure config (Docker, Nginx, certs)
- Connection strings

---

## 2. KIẾN TRÚC MỚI (ON-PREMISE)

```
[Browser (PC/Tablet/ĐT nội bộ)]
    ↓ (HTTPS, self-signed cert, LAN IP)
[Nginx Reverse Proxy] — port 80 (→443), 443 (HTTPS)
    ↓
[Docker Engine (Ubuntu Server)]
    ├─ Service: supabase-db
    │   Image: supabase/postgres@15.2
    │   Port: 5432 (chỉ listen trên localhost Docker network)
    │   Volume: pg_data:/var/lib/postgresql/data
    │
    ├─ Service: supabase-realtime
    │   Image: supabase/realtime:v2.10
    │   Port: 54324 (WebSocket)
    │   Kết nối tới supabase-db
    │
    ├─ Service: supabase-storage
    │   Image: supabase/storage-api:v0.42
    │   Port: 54324 (Storage HTTP API)
    │   Volume: storage_data:/var/lib/storage
    │
    ├─ Service: cencom-web
    │   Build: Dockerfile.standalone
    │   Port: 3000
    │   Env: .env.onpremise
    │
    └─ Service: cencom-nginx
        Image: nginx:alpine
        Port: 80, 443
        Volumes:
          - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
          - ./nginx/certs:/etc/nginx/certs:ro

Volumes:
  pg_data     → PostgreSQL data
  storage_data → Supabase Storage (temp_chat_imgs, exports)
```

### 2.1 Luồng request

1. **Browser** truy cập `https://cencom.lan` (hoặc IP LAN)
2. **Nginx** chấm cert SSL (self-signed) → proxy tới `cencom-web:3000`
3. **Next.js** xử lý `POST /api/rpc` → gọi `packages/core` → truy vấn `supabase-db:5432`
4. **Realtime**: Browser WebSocket tới `wss://cencom.lan/realtime` → Nginx upgrade → `supabase-realtime:54324`
5. **Upload ảnh chat**: Browser → `/api/rpc` (chatSendImg) → `packages/core` gọi `supabase-storage:54324`

---

## 3. PHÂN PHỐI FILE

```
cencomOS_gara_4.0_supa/
├── Onpremise/
│   ├── plan_onpremise.md          ← File này (bản văn bản chính)
│   ├── docker-compose.yml         ← Docker stack (Supabase + Next.js + Nginx)
│   ├── Dockerfile.standalone      ← Build Next.js standalone
│   ├── nginx/
│   │   ├── nginx.conf             ← Cấu hình reverse proxy + WebSocket
│   │   └── certs/                 ← Thư mục chứa self-signed cert (tạo bởi script)
│   ├── scripts/
│   │   ├── init_certs.sh          ← Sinh self-signed cert
│   │   ├── init_db.sh             ← Chạy schema + seed (1 lần đầu)
│   │   ├── deploy_local.sh        ← Build + chạy Docker trên máy dev
│   │   ├── deploy_server.sh       ← Deploy trên Ubuntu Server
│   │   └── backup/
│   │       └── pg_backup.sh       ← Backup PostgreSQL (cron hàng ngày)
│   ├── .env.onpremise             ← Template env variables
│   └── volumes/                   ← Thư mục persist dữ liệu (tạo bởi Docker)
│       ├── pg_data/
│       └── storage_data/
├── supabase/                       ← Từ kế hoạch cloud (dùng chung)
│   ├── config.toml
│   └── migrations/
│       └── 0001_init.sql
└── docs/
    └── onpremise/                  ← Skill docs (copy to DevTools)
        └── SKILL_ONPREMISE.md
```

---

## 4. CHI TIẾT TỪNG FILE

### 4.1 `docker-compose.yml`

> File Docker Compose phiên bản 3.8. Chứa 4 service chính.

```yaml
version: '3.8'

services:
  # ============== PostgreSQL (Supabase self-hosted) ==============
  supabase-db:
    container_name: supabase-db
    image: supabase/postgres:15.2.0
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD:-cencom_pass_2026}
      POSTGRES_DB: ${DB_NAME:-cencom_os}
      POSTGRES_USER: ${DB_USER:-postgres}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 15s
      timeout: 5s
      retries: 5

  # ============== Realtime (WebSocket) ==============
  supabase-realtime:
    container_name: supabase-realtime
    image: supabase/realtime:v2.10.3
    restart: unless-stopped
    depends_on:
      supabase-db:
        condition: service_healthy
    ports:
      - "54324:54324"
    environment:
      DB_DRIVER: postgresql
      DB_HOST: supabase-db
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-cencom_os}
      DB_USER: ${DB_USER:-postgres}
      DB_PASSWORD: ${DB_PASSWORD:-cencom_pass_2026}
      # Disable RLS enforcement — custom auth handles permissions
      REALTIME_AUTH_CLAIM: '{}'
      # Enable for local network
      API_EXTERNAL_URL: http://localhost:54321
    command: ["bin/server", "start"]

  # ============== Storage API ==============
  supabase-storage:
    container_name: supabase-storage
    image: supabase/storage-api:v0.42.6
    restart: unless-stopped
    depends_on:
      supabase-db:
        condition: service_healthy
    ports:
      - "54325:54325"
    environment:
      POSTGREST_DB_URI: postgresql://postgres:${DB_PASSWORD:-cencom_pass_2026}@supabase-db:5432/${DB_NAME:-cencom_os}
      POSTGREST_ADMIN_SERVER_TIMEOUT: 200000
      PGSERVE_EXTERNAL_URL: http://supabase-storage:54325
      STORAGE_BACKEND: file
      FILE_STORAGE_ROOT_PATH: /var/lib/storage
    volumes:
      - storage_data:/var/lib/storage
    command: ["postgrest", "storage-api", "postgres-connection", "${DB_NAME:-cencom_os}"]

  # ============== Next.js App ==============
  cencom-web:
    container_name: cencom-web
    build:
      context: ..
      dockerfile: Onpremise/Dockerfile.standalone
    restart: unless-stopped
    depends_on:
      - supabase-db
    env_file:
      - .env.onpremise
    expose:
      - "3000"

  # ============== Nginx Reverse Proxy ==============
  cencom-nginx:
    container_name: cencom-nginx
    image: nginx:1.25-alpine
    restart: unless-stopped
    depends_on:
      - cencom-web
      - supabase-realtime
      - supabase-storage
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    command: "/bin/sh -c 'while ps aux | grep -v grep | grep -q nginx; do sleep 1; done'"

volumes:
  pg_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./volumes/pg_data
  storage_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./volumes/storage_data
```

### 4.2 `Dockerfile.standalone`

> Build Next.js ở thư mục gốc dự án (context = `cencomOS_gara_4.0_supa/`)

```dockerfile
# ===== BUILD STAGE =====
FROM node:22-alpine AS builder

WORKDIR /app

# Copy tất cả file package.json + lock
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/contract/package.json packages/contract/

# Install dependencies
RUN npm ci --only=production || npm install --omit=dev

# Copy source
COPY apps/web ./apps/web
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY packages/contract ./packages/contract
COPY tsconfig.json ./
COPY supabase/ ./supabase/

# Build Next.js standalone
WORKDIR /app/apps/web
RUN npx @next/bundle-analyzer 2>/dev/null || true
RUN npx prisma generate 2>/dev/null || true
RUN npm run build

# ===== PRODUCTION STAGE =====
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Tạo user không phải root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 nextjs -S -G nextjs

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set permissions
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
```

### 4.3 `nginx/nginx.conf`

```nginx
worker_processes auto;
pid /tmp/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type    application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml application/xml+rss;

    # Security headers (trong mỗi server block)
    # X-Content-Type-Options, X-Frame-Options, CSP, HSTS

    # ============== HTTP → HTTPS redirect ==============
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # ============== HTTPS Server ==============
    server {
        listen 443 ssl http2;
        server_name _;

        # Self-signed certificate
        ssl_certificate     /etc/nginx/certs/server.crt;
        ssl_certificate_key /etc/nginx/certs/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss:; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

        # CSRF protection: chặn origin lệch
        set $origin_ok 0;
        if ($http_origin = "") { set $origin_ok 1; }
        if ($http_origin ~* "^https://(cencom\.lan|cencom\.local|[0-9]+\.[0-9]+\.[0-9]+\.)") {
            set $origin_ok 1;
        }
        if ($origin_ok = 0) {
            return 403;
        }

        # Proxy tới Next.js
        location / {
            proxy_pass http://cencom-web:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_cookie_secure on;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
        }

        # WebSocket proxy cho Realtime (Supabase Realtime)
        location /realtime {
            proxy_pass http://supabase-realtime:54324;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # Storage API proxy (có thể dùng trực tiếp qua API)
        location /storage {
            proxy_pass http://supabase-storage:54325;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        # Health check (ẩn)
        location = /healthz {
            access_log off;
            return 200 "ok\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### 4.4 `.env.onpremise`

> Template — copy thành `.env.onpremise.local` và chỉnh sửa trước deploy

```bash
# ===== Database (PostgreSQL self-hosted) =====
DB_USER=postgres
DB_PASSWORD=cencom_pass_2026
DB_NAME=cencom_os
DB_HOST=supabase-db
DB_PORT=5432
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# ===== Supabase local (Realtime + Storage) =====
SUPABASE_URL=http://supabase-storage:54325
SUPABASE_ANON_KEY=local-anon-key-2026
SUPABASE_SERVICE_KEY=local-service-role-key-2026
SUPABASE_PORT=54325

# ===== Next.js =====
NEXT_PUBLIC_BASE_URL=https://cencom.lan
NEXT_PUBLIC_SUPABASE_REALTIME_URL=wss://cencom.lan/realtime

# ===== Security =====
SESSION_SECRET=thay-bang-64-ky-tu-hex-random-generated-by-node-crypto
SECURE_COOKIE=1  # HTTPS → bật Secure cookie
LOGIN_RATE_LIMIT=1

# ===== Seed (chỉ dùng CLI init, KHÔNG dùng production) =====
FORCE_PW_CHANGE=1
ALLOW_RESET=0

# ===== Other =====
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
```

### 4.5 `scripts/init_certs.sh`

```bash
#!/bin/bash
# Sinh self-signed SSL certificate cho on-premise
# Chạy trước lần đầu deploy

set -e

CERTS_DIR="Onpremise/nginx/certs"

mkdir -p "$CERTS_DIR"

echo "=== Sinh self-signed SSL certificate ==="

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=VN/ST=HoChiMinh/O=CencomOS/OU=IT Department/CN=cencom.lan" \
  -addext "subjectAltName=DNS:cencom.lan,DNS:cencom.local,IP:192.168.0.100"

chmod 600 "$CERTS_DIR/server.key"
chmod 644 "$CERTS_DIR/server.crt"

echo "=== Certificate created at $CERTS_DIR ==="
echo "=== Thêm cert này vào trusted root trên máy trình duyệt để tránh cảnh báo ==="
```

### 4.6 `scripts/init_db.sh`

```bash
#!/bin/bash
# Chạy schema + seed 1 lần đầu khi dự án mới deploy
# Yêu cầu: Docker đã chạy, DB đã healthy

set -e

echo "=== Đợi PostgreSQL sẵn sàng ==="
sleep 10

echo "=== Áp dụng schema ==="
docker exec -i supabase-db psql -U postgres -d cencom_os -c \
  "DO \$\$ BEGIN RAISE NOTICE 'Starting schema init...'; END \$\$;"

# Áp dụng schema từ file
docker cp ../packages/db/schema.sql supabase-db:/tmp/schema.sql
docker exec -i supabase-db psql -U postgres -d cencom_os -f /tmp/schema.sql

echo "=== Áp dụng migrations (nếu có) ==="
for migration in ../supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "Applying: $migration"
        docker cp "$migration" supabase-db:/tmp/$(basename "$migration")
        docker exec -i supabase-db psql -U postgres -d cencom_os -f /tmp/$(basename "$migration")
    fi
done

echo "=== Chạy seed ==="
docker exec -i cencom-web /bin/sh -c "cd /app && node --import tsx packages/db/src/cli.ts seed"

echo "=== Kiểm tra ==="
COUNT=$(docker exec -i supabase-db psql -U postgres -d cencom_os -t -c "SELECT COUNT(*) FROM xe;")
echo "Số xe đã seed: $COUNT"

echo "=== Init DB hoàn tất ==="
```

### 4.7 `scripts/deploy_local.sh`

```bash
#!/bin/bash
# Build + chạy toàn bộ stack trên máy dev (testing local)
# Yêu cầu: Docker Desktop đã cài

set -e

echo "=== 1. Tạo certs (nếu chưa có) ==="
if [ ! -f Onpremise/nginx/certs/server.crt ]; then
    echo "Chạy init_certs.sh trước..."
    bash Onpremise/scripts/init_certs.sh
fi

echo "=== 2. Build Docker images ==="
docker-compose build

echo "=== 3. Khởi động stack ==="
docker-compose up -d

echo "=== 4. Chờ services khởi động ==="
sleep 15

echo "=== 5. Kiểm tra health ==="
docker-compose ps

echo "=== Stack đang chạy tại ==="
echo "  - Next.js:  http://localhost:3000"
echo "  - Nginx:    https://localhost:443"
echo "  - API:      https://localhost/api/health"
echo "  - Realtime: wss://localhost/realtime"
```

### 4.8 `scripts/deploy_server.sh`

```bash
#!/bin/bash
# Deploy trên Ubuntu Server (production)
# Chạy trên server, hoặcqua SSH từ máy dev

set -e

SERVER_IP=${SERVER_IP:-192.168.0.100}
DEPLOY_USER=${DEPLOY_USER:-cencom}
DEPLOY_DIR=${DEPLOY_DIR:-/opt/cencom}

echo "=== Deploy tới server $SERVER_IP ==="

# 1. Build image locally
echo "=== BƯỚC 1: Build Docker image ==="
cd ..
docker build -f Onpremise/Dockerfile.standalone -t cencom-web:latest .
docker save cencom-web:latest -o /tmp/cencom-web.tar

# 2. Copy files lên server
echo "=== BƯỚC 2: Copy files lên server ==="
scp -i ~/.ssh/id_rsa /tmp/cencom-web.tar $DEPLOY_USER@$SERVER_IP:/tmp/
scp -r Onpremise/nginx $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/
scp Onpremise/docker-compose.yml $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/
scp .env.onpremise $DEPLOY_USER@$SERVER_IP:$DEPLOY_DIR/

# 3. Docker load + restart stack trên server
echo "=== BƯỚC 3: Khởi động stack trên server ==="
ssh -i ~/.ssh/id_rsa $DEPLOY_USER@$SERVER_IP << 'REMOTE_SCRIPT'
cd /opt/cencom

# Stop existing
docker-compose down

# Load new image
docker load < /tmp/cencom-web.tar

# Restart
docker-compose up -d

# Wait + health check
sleep 20
docker-compose ps
REMOTE_SCRIPT

echo "=== Deploy hoàn tất ==="
echo "Truy cập: https://$SERVER_IP"
```

### 4.9 `scripts/backup/pg_backup.sh`

```bash
#!/bin/bash
# Cron job: 0 2 * * * /opt/cencom/Onpremise/scripts/backup/pg_backup.sh
# Giữ 7 bản backup

BACKUP_DIR="/opt/cencom/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Bắt đầu backup..."

# PostgreSQL dump
docker exec supabase-db pg_dump -U postgres cencom_os > "$BACKUP_DIR/cencom_$DATE.sql" 2>&1
if [ $? -eq 0 ]; then
    gzip -f "$BACKUP_DIR/cencom_$DATE.sql"
    echo "[$(date)] Backup SQL thành công: $BACKUP_DIR/cencom_$DATE.sql.gz"
else
    echo "[$(date)] Lỗi backup SQL!"
    exit 1
fi

# Docker volume backup
docker run --rm \
    -v cencom_pg_data:/data \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/pg_volume_$DATE.tar.gz" -C /data . 2>&1

# Xóa bản cũ
find "$BACKUP_DIR" -name "cencom_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "pg_volume_*.tar.gz" -mtime +7 -delete

echo "[$(date)] Backup hoàn tất. Dung lượng:"
du -sh "$BACKUP_DIR"
```

### 4.10 `scripts/backup/pg_restore.sh`

```bash
#!/bin/bash
# Restore từ bản backup
# Dùng: ./pg_restore.sh /opt/cencom/backups/cencom_20260814_020000.sql.gz

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

echo "=== Restore từ $BACKUP_FILE ==="

# Stop services
docker-compose down

# Xóa DB cũ
docker-compose up -d supabase-db
sleep 15

# Decompress + restore
gunzip -c "$BACKUP_FILE" | docker exec -i supabase-db psql -U postgres -d cencom_os

echo "=== Restore hoàn tất ==="
docker-compose up -d
```

---

## 5. QUY TRÌNH TRIỂN KHAI CHI TIẾT

### Bước 1: Chuẩn bị môi trường (trên Ubuntu Server)

```bash
# Cài đặt Docker + Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER  # logout/login lại

# Tạo thư mục deploy
sudo mkdir -p /opt/cencom
sudo chown -R $USER:$USER /opt/cencom
```

### Bước 2: Clone / copy code

```bash
cd /opt/cencom
# Clone từ git hoặc copy từ máy dev
git clone <repo-url> .
# Hoặc copy toàn bộ thư mục dự án
```

### Bước 3: Tạo certificates

```bash
chmod +x Onpremise/scripts/init_certs.sh
./Onpremise/scripts/init_certs.sh
```

### Bước 4: Cấu hình environment

```bash
cp Onpremise/.env.onpremise Onpremise/.env.onpremise.local

# Tạo session secret thực tế
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Dán vào Onpremise/.env.onpremise.local -> SESSION_SECRET=<giá trị>

# Chỉnh DB_PASSWORD nếu muốn mật khẩu khác
# Chỉnh NEXT_PUBLIC_BASE_URL thành IP/hostname LAN thực tế
```

### Bước 5: Deploy

```bash
# Deploy local (dev machine):
chmod +x Onpremise/scripts/deploy_local.sh
./Onpremise/scripts/deploy_local.sh

# Deploy production (Ubuntu Server):
chmod +x Onpremise/scripts/deploy_server.sh
SERVER_IP=192.168.0.100 ./Onpremise/scripts/deploy_server.sh
```

### Bước 6: Initialize database (chỉ 1 lần)

```bash
# Chạy trên server sau khi stack đã lên
chmod +x Onpremise/scripts/init_db.sh
./Onpremise/scripts/init_db.sh
```

### Bước 7: Cấu hình cron backup

```bash
# Thêm cron job backup hàng ngày 2h sáng
crontab -e
# Thêm dòng:
# 0 2 * * * /opt/cencom/Onpremise/scripts/backup/pg_backup.sh >> /opt/cencom/backups/cron.log 2>&1
```

### Bước 8: Cấu hình firewall (LAN-only)

```bash
# Chặn Internet inbound, chỉ cho phép LAN
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 443
sudo ufw allow from 192.168.0.0/16 to any port 80
sudo ufw allow 5432 from localhost  # PostgreSQL chỉ local
sudo ufw enable
```

### Bước 9: Thêm cert vào trusted root (trên máy user)

- Trên Windows: Dùng `mmc.exe` → Add/Remove Snap-in → Certificates → Trusted Root Certification Authorities → Import `server.crt`
- Trên Linux: `cp server.crt /usr/local/share/ca-certificates/cencom.crt && update-ca-certificates`

---

## 6. BẢO MẬT (ON-PREMISE EDITION)

| Lớp | Kiểm biễn |
|---|---|
| **Network** | UFW firewall chặn inbound ngoại trừ 80/443 từ subnet 192.168.0.0/16; PostgreSQL chỉ bind trên Docker network |
| **SSL** | Self-signed cert; thêm vào trusted root để tránh cảnh báo |
| **Auth** | Custom `packages/core` (scrypt + session cookie) — không thay đổi |
| **Cookie** | `SameSite=Strict` + `HttpOnly`; `Secure` bật khi HTTPS |
| **CSRF** | Nginx chặn origin lệch + middleware Next.js |
| **Input validation** | Zod schemas (packages/contract) — không thay đổi |
| **RBAC** | Check trong `packages/core` handlers — không thay đổi |
| **Rate limit** | `LOGIN_RATE_LIMIT=1` trong env |
| **Log** | PostgreSQL logs + Nginx access/error logs → rotate |
| **Secret** | `.env.onpremise.local` trong `.gitignore` |

---

## 7. QUAN SÁT (MONITORING)

### 7.1 Health checks
- Docker healthcheck: `curl -f http://localhost:3000/api/health`
- Nginx location `/healthz` → trả "ok" (ẩn)
- PostgreSQL: `pg_isready -U postgres`

### 7.2 Logs
```bash
# Xem logs từng service
docker logs cencom-web --tail 50 -f
docker logs supabase-db --tail 50 -f
docker logs supabase-realtime --tail 50 -f

# Nginx logs
docker logs cencom-nginx --tail 50 -f
```

### 7.3 Metrics
- Dùng `docker stats` theo dõi CPU/Memory
- Khi cần: thêm Prometheus + Grafana (tùy chọn)

---

## 8. BACKUP & DISASTER RECOVERY

| Loại | Tần suất | Vị trí | Retain |
|---|---|---|---|
| PostgreSQL dump | Hàng ngày 2h sáng | `/opt/cencom/backups/` | 7 bản |
| Docker volumes | Hàng tuần | `/opt/cencom/backups/` | 4 bản |
| Schema/migrations | Git | Repository | Vĩnh viễn |
| Config (.env.onpremise.local) | Git (exclude sensitive) | `/opt/cencom/` | Vĩnh viễn |

**Quy trình restore khẩn cấp:**
1. `./scripts/backup/pg_restore.sh <backup_file>`
2. `docker-compose up -d`
3. Verify: truy cập `https://<server_ip>/api/health`

---

## 9. CHUYỂN ĐỔI SANG CLOUD (khi cần mở rộng)

Khi công ty quyết định chuyển sang Vercel + Supabase managed:

| Thành phần | On-Premise | Chuyển sang Cloud |
|---|---|---|
| Docker Compose → Vercel | `docker-compose.yml` bỏ qua | Deploy Next.js trên Vercel |
| DATABASE_URL | `postgresql://postgres@supabase-db:5432` | `postgresql://postgres@db.<ref>.supabase.co:5432` |
| SUPABASE_URL | `http://supabase-storage:54325` | `https://<ref>.supabase.co` |
| Storage | Supabase self-hosted | Supabase managed |
| Realtime | Supabase Realtime self-hosted | Supabase Realtime managed |
| Auth | Custom | Custom (giữ nguyên) |

**=> `packages/core` và `packages/db/schema.sql` không thay đổi.**

---

## 10. TROUBLESHOOTING

| Vấn đề | Nguyên nhân | Cách khắc phục |
|---|---|---|
| WebSocket realtime không kết nối | Nginx không proxy Upgrade header | Kiểm tra `proxy_set_header Upgrade` trong nginx.conf |
| Cert cảnh báo browser | Self-signed chưa trust | Thêm `server.crt` vào Trusted Root CA trên máy user |
| DB connection refused | PostgreSQL chưa healthy | Chờ `supabase-db` healthy trước khi chạy web |
| Storage ảnh chat lỗi | Storage API chưa init | Chạy `docker-compose up -d supabase-storage` riêng |
| Export Excel lỗi | Next.js standalone không có file | Kiểm tra copy `/apps/web/.next/static` |
| Rate limit quá chặt | Sai IP trong `X-Forwarded-For` | Kiểm tra Nginx proxy_set_header |

---

## 11. THỜI GIAN TRIỂN KHAI ƯỚC TÍNH

| Bước | Thời gian |
|---|---|
| 1. Build Docker + test local | 2-3 ngày |
| 2. Init DB + seed + verify | 1 ngày |
| 3. Cấu hình Nginx + cert + firewall | 1 ngày |
| 4. Chạy conformance test ≥320 pass | 2 ngày |
| 5. Test toàn bộ luồng business | 2-3 ngày |
| **Tổng** | **7-10 ngày** (cùng conformance) |

---

## 12. FILES CẦN TẠO

| File | Mô tả | Trạng thái |
|---|---|---|
| `Onpremise/plan_onpremise.md` | File này | ✅ Đã tạo |
| `Onpremise/docker-compose.yml` | Docker stack | Chờ tạo |
| `Onpremise/Dockerfile.standalone` | Build Next.js | Chờ tạo |
| `Onpremise/nginx/nginx.conf` | Reverse proxy config | Chờ tạo |
| `Onpremise/.env.onpremise` | Env template | Chờ tạo |
| `Onpremise/scripts/init_certs.sh` | Sinh cert | Chờ tạo |
| `Onpremise/scripts/init_db.sh` | Init DB | Chờ tạo |
| `Onpremise/scripts/deploy_local.sh` | Deploy local | Chờ tạo |
| `Onpremise/scripts/deploy_server.sh` | Deploy production | Chờ tạo |
| `Onpremise/scripts/backup/pg_backup.sh` | Backup script | Chờ tạo |
| `Onpremise/scripts/backup/pg_restore.sh` | Restore script | Chờ tạo |

---

> **⚠️ Lưu ý hệ thống sản xuất (Production Check):**
> - **Con thiếu gì?** Volumes persist chưa được mount persistently (dùng Docker bind mount); cert chưa trust trên máy user; firewall chưa config; backup chưa test restore.
> - **Rủi ro ở đâu?** Self-signed cert gây cảnh báo; WebSocket proxy có thể timeout nếu không tune `proxy_read_timeout`; DB volume mount thiếu dẫn mất data khi container restart; Supabase Realtime self-hosted có thể memory leak nếu không tune.
> - **Đã chạy test chưa?** Chưa — các file cấu hình cần được tạo trước. Khi hoàn thiện: chạy `docker-compose up`, verify health, chạy conformance ≥320 pass.
> - **Đề xuất tiếp theo?** Tạo toàn bộ file config, test end-to-end trên máy local trước khi deploy production.