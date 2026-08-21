# KẾ HOẠCH CHI TIẾT — GIAI ĐOẠN 3: PRODUCTION DEPLOYMENT & MONITORING

**Dự án:** cencomOS Gara v5 (`gara_reconstruction_v5`, subdir của repo `cencomOS_gara_4.0_supa`)
**Ngày:** 2026-08-21
**Mục tiêu:** Hoàn thiện triển khai production — build/standalone, Docker on-premise, CI deploy, monitoring hoàn chỉnh, rollback, và UAT 20 use-case tự sửa chữa.

---

## 1. GPS đầu vào (từ GĐ2)
- GĐ2 còn lại đã xong: security review (`docs/SECURITY_REVIEW.md`), CI skeleton (`.github/workflows/ci.yml`+`deploy.yml`), prod docs, monitoring scaffold (`lib/observability.ts`+`docs/MONITORING.md`), fix DEP0190 (`scripts/run-e2e.mjs`).
- `tsc` = 0, `test:ci` = 236/236, `e2e` = PASS.
- Next 14.2.35 (2 high audit residual → `docs/SECURITY_NEXT16_RISK.md`).
- `Onpremise/` hiện target v4 monorepo → cần adapt riêng cho v5.
- `gara_reconstruction_v5` là **subdir của repo cha** (chưa commit riêng).

---

## 2. Workstreams (6 luồng song song)

### P3-A — Build & Standalone (gating deployability)
- Đọc `next.config.js`; thêm `output: 'standalone'`.
- Chạy `npm run build` từ `gara_reconstruction_v5`; sửa đến khi build xanh (chứng minh deployable). Build KHÔNG cần port 3001.
- File: `next.config.js` (+ sửa tối thiểu để build pass).

### P3-B — Docker on-premise cho v5
- `gara_reconstruction_v5/Dockerfile` (multi-stage: build → copy standalone output + runtime node_modules vào image slim).
- `gara_reconstruction_v5/docker-compose.yml` (service `web` + `db` postgres:16-alpine + volume `pg_data`).
- `gara_reconstruction_v5/nginx.conf` (reverse proxy → web:3000, SSE `/api/realtime`, SSL self-signed, HTTP→HTTPS).
- `gara_reconstruction_v5/scripts/init_db.mjs` (chạy `tsx db/migrate.ts` + `db/seed.ts` + `db/realtime_triggers.sql`).
- `gara_reconstruction_v5/scripts/backup_db.sh` + `restore_db.sh`.
- Validate `docker compose -f docker-compose.yml config` nếu docker có sẵn.
- KHÔNG sửa business logic.

### P3-C — CI/CD deploy wiring
- `.github/workflows/ci.yml`: thêm job `build` (`npm run build`) chặn nếu build fail; job `test` giữ nguyên.
- `.github/workflows/deploy.yml`: build image v5 + deploy on-premise (scp/ssh) hoặc Vercel; dùng secrets đã liệt kê (HOST/SSH_USER/SSH_KEY/DEPLOY_PATH hoặc VERCEL_*). Trigger trên tag `v*`.
- YAML hợp lệ.

### P3-D — Monitoring hoàn chỉnh
- Tạo `instrumentation.ts` (Next.js) gọi `installGlobalErrorHandlers()` từ `lib/observability.ts` (bắt `unhandledRejection`/`uncaughtException`, log ERROR+stack).
- Đảm bảo route `/api/health` (check DB up) và `/api/metrics` (Prometheus format) tồn tại — tạo mới nếu thiếu (route file mới, low risk).
- Chỉ file mới / thêm route nhẹ; không đổi business.

### P3-E — Rollback & Ops docs
- `gara_reconstruction_v5/scripts/rollback.sh` (git revert về tag + restore DB từ backup).
- Cập nhật `docs/PRODUCTION.md` (thêm bước build Docker, rollback, monitoring).
- Tạo `gara_reconstruction_v5/DEPLOY.md` (hướng dẫn deploy v5 on-premise/cloud + git tag `v5.x.x`).
- Cập nhật `Onpremise/README_VERIFIED.md` thành hướng dẫn v5 (hoặc note redirect).

### P3-F — UX 20-case self-heal UAT
- Viết Playwright script (spec hoặc script tự chứa) đi qua **20 use-case**: login(admin) → dashboard → SC list → tạo SC → mở detail → thêm công việc → thêm vật tư → đổi trạng thái SC → xe list → tạo xe → kho (vật tư list) → kho nhập → kho xuất → báo giá list → tạo báo giá → hồ sơ list → tạo hồ sơ → search/filter → logout → re-login.
- Chạy, thu thập **console error / page error / assertion fail**.
- **TỰ SỬA CHỮA**: với mỗi bug, fix code (`app/` hoặc `lib/`) rồi chạy lại đến khi 20 case xanh (hoặc ổn định). Ghi `docs/UX_20CASE_REPORT.md` (case, bug, fix).
- Lưu ý: admin tạo row bị **quarantine (is_test=1)** → assert modal đóng / không lỗi, KHÔNG assert row hiển thị.
- Dùng port 3001, mirror `scripts/run-e2e.mjs` để khởi động server (spawn node + cli.js, shell:false).

---

## 3. Quy tắc tránh xung đột
- Agents **KHÔNG commit/push** (orchestrator commit sau).
- **Chỉ P3-F** chạy server/Playwright (tránh clash DB/port 3001). Các agent khác KHÔNG chạy `test:ci`/`e2e`. Riêng P3-A chạy `npm run build` (không cần port).
- File scop disjoint: P3-A=`next.config.js`; P3-B=Dockerfile/compose/nginx/scripts mới; P3-C=`.github`; P3-D=`instrumentation.ts` mới + route mới; P3-E=scripts/rollback + docs; P3-F=`tests/ux` + sửa `app/`/`lib/`.

---

## 4. Verification gates (orchestrator cuối, 1 lần)
- `npx tsc --noEmit` = 0
- `npm run test:ci` = 236/236
- `npm run e2e` = PASS
- `npm run build` = thành công (standalone)
- UX 20-case = PASS (hoặc bug đã fix + report)
- `docker compose config` hợp lệ (nếu docker có)

---

## 5. Rủi ro & fallback
- Build fail → P3-A sửa đến xanh; báo cụ thể nếu không được.
- UX có bug sửa không xong → ghi nhận report, orchestrator xử lý tiếp.
- Docker không chạy thật (thiếu server) → chỉ validate config + build.
- Nâng Next 16 (dọn 2 high audit) để sang đợt riêng (P3 không làm, đã có risk doc).
