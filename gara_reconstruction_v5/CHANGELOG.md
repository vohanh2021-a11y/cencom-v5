# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/specs/2.0.0.html).

## Unreleased — Wave A deploy gaps (plan PLAN_DEPLOY_GAPS.md)

### Added
- `GET /api/version` (public, no-store): deploy governance §4 — xác nhận bản đang chạy.
- `Onpremise/smoke_run.cmd`: chạy smoke nền trên Windows (nạp env từ `.env.onpremise.local`).

### Fixed
- `qs` patch qua `npm audit fix` (moderate array-limit bypass + DoS).
- `backup.sh` / `restore.sh` / `backup/pg_backup.sh`: default v5 (`cencom_v5_db`/`cencom`, đọc `.env.onpremise.local`) thay vì stale v4.
- `healthcheck.sh`: default container v5.
- nginx: thêm HSTS + `proxy_hide_header` server-level (dẹp header trùng DENY-vs-SAMEORIGIN).
- `next.config.js`: `productionBrowserSourceMaps: false` + `removeConsole` (giữ error/warn) — governance Iron Law #4.
- Smoke: login 5 roles + RBAC spot-check (giãn 65s né rate-limit 5 lần/5 phút), trim env chống space.

### Verified
- Backup đầu tiên `cencom_2026-09-07_11-22-59.sql.gz` (8.8KB) → restore khớp `xe=42 users=6` → DROP DB test.
- Scheduled Task `CencomV5Backup` (CN 02:00) đã chạy thử ra file.
- Smoke 5 roles + MCP: PASS EXIT 0.

### Added (Wave C — hardening, cùng ngày)
- **AI fallback chain** (governance §7): `providerModels()` + `callProviderWithFallback()` —
  thử tuần tự `models[]` (UI nhập phân cách phẩy), cooldown 300s/model cho lỗi
  mạng/429/5xx, log failover như SLO; chat route + UI Settings dùng mới.
- **Watchdog monitoring tối thiểu** (governance §8 lớp 1): `Onpremise/scripts/watchdog.cmd`
  (Windows Task 5 phút, HEALTHY/UNHEALTHY + streak + ALERT ≥3 lần liên tiếp) +
  `healthcheck.sh` hỗ trợ `PORT_NGINX` cho cổng override. Đã verify live:
  HEALTHY khi web up, UNHEALTHY streak khi dừng web.
- **LICENSE proprietary + EULA v1.0** (lớp pháp lý governance §6.3) — draft, chờ luật sư.
- **Quyết định chống dịch ngược** (`docs/DECISION_OBFUSCATION.md`): DEFER obfuscation
  cho LAN nội bộ — lớp 1 đã đủ (no sourcemap/no dev file/strip console), lớp 2 kích
  hoạt khi bán ngoài (điều kiện viết rõ).

### Fixed
- `postcss` 8.5.26→8.5.28, `autoprefixer`, `tsx` (npm update — postcss vẫn nằm trong
  advisory qua next@14, fix thật = Next 16, đã đánh dấu kế hoạch riêng).

## v5.4.0 - 2026-09-04 (Hub-and-Spoke + AI nhúng, plan_4.9)

### Added
- **electron-hub 5.4.0** (all-in-one ~113MB khi có PG): portable PG 16 lifecycle
  (`ensureHubDb`/`pg_ctl`, data `%APPDATA%/CencomOS/hub-data`, port 5433),
  `pg-portable/README.md` + `scripts/fetch-pg.ps1` (binary gitignore, tải riêng).
- **electron-spoke 5.4.0** (thin ~76MB): nhập IP HUB, `spokeAPI`, queue file JSON
  offline (`spoke-queue.json`), badge `SyncStatus` + nút Đồng bộ.
- **Sync engine**: `POST /api/sync/push` (Zod+RBAC, trả accepted/conflicts),
  `POST /api/sync/confirm`, `GET /api/sync/pull`; bảng `sync_devices/sync_log`.
- **AI nhúng tại HUB**: `lib/ai-config.ts` (AES-256-GCM qua SESSION_SECRET),
  `lib/ai.ts` (system prompt khóa phạm vi + tool-calling 81 tools),
  `POST /api/ai/chat` (lưu `ai_conversations/messages`), `GET/POST /api/ai/config`,
  `POST /api/ai/test`, trang `settings/ai` (provider **zen** + `mimo-v2.5` mặc
  định — api.b.ai không có model phù hợp), dock `AiChat` toàn app.
- **Vision hóa đơn**: `POST /api/ai/vision` (base64 → vision model → JSON
  `{ncc, ngay, items}`), `VisionUpload` gắn form báo giá, job `ai_vision_jobs`.
- **Backup 1-click**: `POST /api/backup` (`pg_dump -Fc`), trang `settings/backup`.

### Fixed
- Health `/api/health` đọc version tĩnh từ `package.json` (hết '5.0.0' ảo khi
  spawn `node server.js`); `mcp-server/env.ts` không đè `DATABASE_URL` của
  Docker compose (onlyIfMissing) — on-prem mcp hết crash `127.0.0.1:5432`.
- `Set-Content UTF8` ghi BOM làm vỡ webpack JSON — dùng UTF8 no-BOM.

### Verification
- `tsc --noEmit` 0; `conformance` **839/839 (28 suites, EXIT 0)**;
  `smoke_onpremise.mjs` **6/6 PASS** qua nginx HTTPS (web 5.4.0, MCP 81 tools);
  `opencode mcp list` ✓ cencom-gara connected; video `hub-spoke_with_voice.webm`.

## v5.3.0 - 2026-09-04

### Added
- **GĐ6 — phân trang server-side MỌI danh sách lớn** (PLAN "Pagination mọi
  danh sách"): `scList` (default 1.000, clamped, tie-breaker `id DESC` cho OFFSET
  ổn định), `vattuList`/`xeList`/`baogiaList`/`hoSoList` (default 2.000),
  `baoDuongList` cap 2.000 — chống DB phình làm sập khi 10k+ phiếu.
- **GĐ6 — cache TTL báo cáo kế toán**: `ledgerReport` bọc `cached()` 5 phút
  theo khóa kỳ (`rpt:kt:<tu>:<den>`, single-flight); `kyClose`/`kyOpen`
  `clearPrefix` để chốt kỳ luôn đọc số mới.
- **GĐ6 — trigram GIN cho globalSearch**: `pg_trgm` + index `vattu.ten`,
  `xe.bien_so`, `sc.id`, `dm.id` (ILIKE '%term%' hết sequential scan; guard
  DO-block — cloud thiếu quyền chỉ NOTICE, không abort migrate).
- **GĐ6 — export an toàn**: semaphore 2 slot tiến trình (429 + Retry-After khi
  nghẽn), trần 20.000 dòng/loi export, WARN khi >5s (phát hiện DB phình sớm).
- **GĐ9 — Docker stack on-premise v5 chạy THẬT**: `node:20-slim` (alpine lỗi
  exec-format trên Docker Desktop Windows), stage `mcp` riêng (tsx global +
  COPY lib/mcp-server + full node_modules — runner prod-slim thiếu MCP SDK),
  compose `target` web=runner mcp=mcp.
- **GĐ9 — nginx chống single-point-of-failure**: upstream `mcp` tĩnh → biến +
  `resolver 127.0.0.11` (trước: mcp chưa DNS-resolvable là nginx [emerg] chết,
  KEO theo web dù web healthy).
- **GĐ9 — init pipeline một lệnh**: `db/migrate.ts` chạy 3 file
  (schema + accounting + realtime_triggers — các file idempotent, tự skip
  schema.sql nếu DB đã init lần 1, hết crash 'already exists' khi chạy lại).
- **GĐ9 — tài khoản MCP chuyên dụng**: `scripts/create-mcp-user.ts` (role
  giamdoc, must_change=0 — seed user bị cổng RPC must_change chặn); MCP
  HTTP fail-closed đúng khi thiếu MCP_PASS/MCP_API_KEY.
- **GĐ9 — smoke end-to-end thật**: `Onpremise/scripts/smoke_onpremise.mjs` —
  login → dashboardAll → scList limit → export xlsx → MCP initialize +
  tools/call QUA nginx HTTPS. PASS 6/6 trên Docker Desktop Windows 04.09.
- `Onpremise/docker-compose.override.yml` (gitignored) cho máy dev Windows
  chiếm cổng 80/443/5432; Ubuntu production KHÔNG có file này → chuẩn.

### Fixed
- `vattuList` SQL thừa placeholder `$1` (deleted_atliteral) → PG 'bind message
  has 3 parameters' làm 3 suite conformance đỏ (business/in_a4/rpc) — đã xanh
  trở lại **777/777 (28 suites, CONF_EXIT=0)**.
- Template `.env.onpremise` còn tham chiếu Supabase v4 (DB_HOST=supabase-db,
  DB_NAME=cencom_os) → chuẩn hóa v5: `db`/`cencom` + guide MCP_*.

### Verification (Production check)
- `npx tsc --noEmit` = 0 lỗi.
- `npm run test:conformance` = 28 suites, **777 pass / 0 fail** (isolated runner).
- Stack Docker thật: 4/4 container healthy + smoke 6/6 PASS + seed 42 xe
  đọc qua MCP `dashboardAll` = kpi.xe:42.

## v5.0.0 - 2026-08-21

### Added
- **Production docs**: `.env.production.example`, `docs/PRODUCTION.md`, `CHANGELOG.md`
- CI/CD pipeline skeleton (GitHub Actions) for build + deploy
- On-premise deployment scripts under `Onpremise/`
- Monitoring/observability scaffolding (`lib/observability.ts`, `docs/MONITORING.md`)

### Changed
- **Security hardening**: OWASP review (RPC, auth, RBAC, input validation), fixed DEP0190 warning in `setup.ts`
- Dependency update: `next` patched to `14.2.35` (resolved 2 high severity transitive vulnerabilities)
- Codebase: `utf16be` → `swap16` fix, `npx tsc --noEmit` = 0 errors
- Project structure: added `docs/PLAN_GIAIDOAN_2_3.md` with multi-wave hardening plan

### Fixed
- Conformance test suite: **236/236** passing
- Smoke test: PASS
- E2E test suite: PASS
- UAT video recorded: `videos/uat-tour.mp4` (1.68 MB)
- Security: hardened env variable handling, added placeholder-safe `.env.production.example`
- Build: verified `npm run build` succeeds on clean state

### Removed
- Deprecated inline session secret from repo history
- Old CI config references (migrated to new GitHub Actions skeleton)

### Security
- Added `.env.production.example` with safe placeholders (no real secrets committed)
- OWASP review completed: input validation, RBAC, RPC boundaries
- Dependency hardening: patched transitive `next`/`postcss` vulnerabilities

### CI/CD
- GitHub Actions workflows added: `ci.yml` (lint + typecheck + test), `deploy.yml` (build + start)
- Conformance gate: `npm run test:ci` >= 236/236 required before merge
- On-premise deploy verified via `Onpremise/scripts/`

### Next.js
- Framework version: **14.2.35** (latest stable in 14.x series)
- All TypeScript strict mode passes with 0 errors
- TailwindCSS 3.x configured and verified