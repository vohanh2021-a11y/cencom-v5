# MONITORING & OBSERVABILITY — CencomOS Gara v5

Hướng dẫn bật monitoring, log rotation, cảnh báo error-rate, và theo dõi production.

---

## 1. Kiến trúc observability hiện tại

| Lớp | File | Mô tả |
|---|---|---|
| Structured Logger | `lib/logger.ts` | Level control, secret redaction, module scoping |
| Observability Facade | `lib/observability.ts` | `logInfo/logWarn/logError` + `createScopedLogger` + global error handlers |
| Prometheus Metrics | `lib/metrics.ts` | Counter `http_requests_total`, `rpc_errors_total`, `login_fail_total`, `sc_created_total` |
| Health Check | `app/api/health/route.ts` | `GET /api/health` — trả 200 (DB up) hoặc 503 (DB down) |
| Metrics Endpoint | `app/api/metrics/route.ts` | `GET /api/metrics` — Prometheus text format |

---

## 2. Bật / cấu hình logging

### 2.1 Env vars

```bash
# .env.local (hoặc .env.production)

# Level: debug | info (default) | warn | error
LOG_LEVEL=info
```

- `debug`: ghi EVERYTHING (chỉ dùng khi debug)
- `info` (default): info + warn + error
- `warn`: chỉ warn + error
- `error`: chỉ error

### 2.2 Ví dụ log output

```
[2026-08-21T10:30:00.000Z] INFO  module=rpc message="RPC OK" fn=scCreate userId=USR-000001
[2026-08-21T10:30:01.000Z] ERROR module=realtime message="PG client error" name=Error message="Connection refused" stack=Error: Connection refused...
```

### 2.3 Secret redaction

Logger tự động redact các field chứa: `token`, `password`, `secret`, `apikey`, `authorization`, `session`, `cookie`, `credential`. Giá trị hiển thị `[REDACTED]`.

---

## 3. Sử dụng observability trong code

```typescript
// Import toàn cục (module = 'app')
import { logInfo, logWarn, logError } from '@/lib/observability';
logInfo('Server started', { port: 3000 });
logError('Something broke', error, { userId: 'USR-0001' });

// Import scoped (module = 'rpc', 'kho', v.v.)
import { createScopedLogger } from '@/lib/observability';
const log = createScopedLogger('rpc');
log.logInfo('RPC dispatched', { fn: 'scCreate' });
log.logError('RPC failed', err, { fn: 'scCreate' });
```

---

## 4. Global error handlers (server startup)

```typescript
// middleware.ts hoặc server startup
import { installGlobalErrorHandlers } from '@/lib/observability';
installGlobalErrorHandlers();
```

Handler này bắt:
- `process.on('unhandledRejection')` — Promise rejection bị bỏ sót
- `process.on('uncaughtException')` — Exception chưa được catch

> ⚠️ **CHỈ chạy server-side** (Next.js middleware hoặc API route startup). KHÔNG gọi ở client.

---

## 5. Health check endpoint

```bash
curl http://localhost:3000/api/health
```

**Response 200 (DB up):**
```json
{
  "ok": true,
  "db": "up",
  "uptimeSec": 3600,
  "version": "5.0.0",
  "ts": "2026-08-21T10:30:00.000Z"
}
```

**Response 503 (DB down):**
```json
{
  "ok": false,
  "db": "down",
  "error": "Database connection failed",
  "uptimeSec": 3600,
  "version": "5.0.0",
  "ts": "2026-08-21T10:30:00.000Z"
}
```

---

## 6. Prometheus metrics

```bash
curl http://localhost:3000/api/metrics
```

**Metrics hiện tại:**

| Metric | Type | Labels | Mô tả |
|---|---|---|---|
| `http_requests_total` | counter | method, path, status | Tổng HTTP requests |
| `login_fail_total` | counter | reason | Tổng lần đăng nhập thất bại |
| `rpc_errors_total` | counter | fn, error | Tổng lỗi RPC handler |
| `sc_created_total` | counter | status | Tổng phiếu sửa chữa tạo |

### Kết nối với Prometheus server

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cencomos-gara'
    scrape_interval: 15s
    static_configs:
      - targets: ['your-server:3000']
    metrics_path: '/api/metrics'
```

---

## 7. Log rotation (on-premise / Docker)

### 7a. Docker (đã dùng `docker-compose.yml`)

```yaml
# Docker daemon tự động rotate stdout/stderr của containers
# Config trong /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 7b. systemd (bare-metal Linux)

```ini
# /etc/systemd/system/cencomos.service
[Service]
StandardOutput=journal
StandardError=journal
# Systemd journal tự quản lý log retention

# Để clear old logs:
# journalctl --vacuum-time=7d
```

### 7c. Next.js stdout → file (tùy chọn)

```bash
# Redirect stdout/stderr ra file với logrotate
node server.js >> /var/log/cencomos/app.log 2>&1

# /etc/logrotate.d/cencomos
/var/log/cencomos/app.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

---

## 8. Cảnh báo error-rate cao

### 8a. Quan sát qua Prometheus

```promql
# Tỷ lệ lỗi RPC trong 5 phút
rate(rpc_errors_total[5m]) / rate(http_requests_total{path="/api/rpc"}[5m]) > 0.05
# → Cảnh báo nếu > 5% requests bị lỗi
```

### 8b. Quan sát qua health check

```bash
# Script check health định kỳ (cron / monitoring service)
#!/bin/bash
RESP=$(curl -sf http://localhost:3000/api/health)
if [ $? -ne 0 ] || [ "$(echo $RESP | jq -r .ok)" != "true" ]; then
  echo "ALERT: Health check failed!"
  # Gửi notification (email, Slack, Telegram, v.v.)
fi
```

### 8c. Sentry (tùy chọn — KHÔNG thêm dependency nếu không cần)

Nếu app quan trọng và cần **crash reporting** real-time:

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts (Next.js 14+)
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% traces
  environment: process.env.NODE_ENV,
});
```

> ⚠️ **Lưu ý**: Sentry thêm ~50KB bundle. Với app nội bộ/intranet, dùng health check + Prometheus metrics là đủ.

---

## 9. Monitoring khi chạy On-Premise (Docker)

```bash
# Kiểm tra trạng thái containers
docker ps --filter name=cencom

# Xem logs real-time
docker logs -f cencom_web

# Kiểm tra health
curl -k https://localhost/api/health

# Prometheus + Grafana (tùy chọn)
# docker-compose thêm:
#   prometheus (scrape /api/metrics)
#   grafana (dashboard)
```

### Grafana dashboard mẫu

Import dashboard Prometheus rồi thêm query:

```
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(rpc_errors_total[5m])

# Uptime
time() - process_start_time_seconds
```

---

## 10. Production Checklist

- [ ] `LOG_LEVEL` set trong `.env.production` (không để `debug`)
- [ ] Health check endpoint hoạt động (`curl /api/health`)
- [ ] Metrics endpoint hoạt động (`curl /api/metrics`)
- [ ] Log rotation đã cấu hình (Docker/logrotate/systemd)
- [ ] `installGlobalErrorHandlers()` đã gọi ở server startup
- [ ] Secret redaction đang hoạt động (kiểm tra log không chứa password)
- [ ] Error-rate alert đang chạy (Prometheus rule hoặc health check script)
