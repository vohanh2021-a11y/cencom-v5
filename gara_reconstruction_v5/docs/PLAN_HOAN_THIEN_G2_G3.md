# PLAN HOÀN THIỆN GĐ2 (Pre-deployment) + GĐ3 (Production) — v5.0

> Ngày: 2026-08-20 · Orchestrator: swarm · Dự án: `gara_reconstruction_v5`
> Tham chiếu: `AGENTS.md` (global + project), skill `vibe-deploy-checklist`, `ux-video-audit`, `scenario-video-tutorial`, `verification-before-completion`.

---

## 0. TRẢ LỜI: "Tại sao 320 case nhiều vậy, có lỗi thiết kế không?"

**Kết luận: CÓ lỗi thiết kế — 2 lớp.**

1. **Con số 320 là di sản v3.6, không phải phân tích v5.** AGENTS.md ghi "conformance ≥320 pass" — kế thừa từ v3.6 (327 test nguồn). Bộ test v5 hiện viết lại chỉ có ~178 case (140 RBAC + 38 RPC) — con số 320 KHÔNG được tính lại từ nghiệp vụ v5.

2. **Test hiện tại có false-positive (pass giả):**
   - `rbac.test.ts` dòng 47: `expect([200, 404]).toContain(res.status)` → coi **404 là ALLOW** → test PASS giả khi fn không tồn tại / lỗi server. Phải assert 200 + `body.ok === true`.
   - Token capture tĩnh lúc import (`export let adminToken=''` + `beforeAll` gán sau) → do CJS destructuring, các test file giữ giá trị `''` lúc require → mọi RPC gửi `sid=` rỗng → 401 hàng loạt (chính là lý do test fail/timeout trước đó).
   - Empty-test: `if (result?.length)` khi DB trống → pass vô nghĩa, không assert gì.
   - `FN_ARGS` thiếu 13/28 fn → args `{}` → không kiểm tra được nghiệp vụ.

**Giải pháp đúng:** thiết kế lại ma trận ĐẦY ĐỦ + ĐÚNG ngữ nghĩa:
- RBAC ma trận: 5 role × 32 fn = **160** (assert status chính xác, `ok:true` cho ALLOW, 401/403 cho DENY, không chấp nhận 404).
- Contract + business-rule + edge-case: **~120** (state machine SC, ton kho âm, validation Zod, soft-delete, chuỗi quyết toán).
- Auth/Security/IDOR: **~40** (token sai/hết hạn, không token, IDOR cross-role).
→ Tổng **~320 case CHẤT** (số trùng là tình cờ — tiêu chí là độ phủ + không false-positive).

---

## 1. NGUYÊN TẮC TRIỂN KHAI SWARM

- **Mỗi agent = 1 port/lĩnh vực** (không đụng file của nhau): test-owner, security-owner, observability-owner, scripts-owner, ci-owner, smoke-owner, e2e-owner, video-owner.
- **Chủ quyền file tuyệt đối** (xem bảng §5) — agent chỉ sửa file được reserve; mọi thay đổi ngoài phạm vi phải báo cáo, không tự ý sửa.
- **Output contract mỗi agent** (bắt buộc): ① objective ② output_format ③ tools_guidance ④ task_boundaries.
- **Verification gate**: sau mỗi wave chạy `npx tsc --noEmit` + `npm run build` + test liên quan TRƯỚC khi merge sang wave sau.
- **package.json chỉ 1 người sửa** (test-owner A1) — các agent khác chỉ TẠO FILE mới, báo cáo script cần thêm; orchestor merge package.json cuối wave.

---

## 2. WAVE A — HOÀN THIỆN GĐ2 (Pre-deployment & Security)

> Mục tiêu: test thật pass + security OWASP + observability + scripts vận hành.

### A1 — Test-owner (port 3101) · files: `tests/conformance/*`, `jest.config.js`, `tsconfig.test.json`, `package.json`
- [ ] Sửa `setup.ts`: export token qua **getter** (`export function getAdminToken()`) hoặc module namespace để test đọc token SAU beforeAll (fix CJS capture tĩnh).
- [ ] Sửa `rbac.test.ts`: bỏ `[200,404]`; ALLOW → expect 200 + `ok:true`; DENY → 401/403. Đủ 5 role × toàn bộ FN_LIST trong `lib/rpc.ts` (32 fn).
- [ ] Sửa `rpc.test.ts`: bỏ empty-test; dùng data đã seed; thêm edge-case (args thiếu → 400/422, args sai kiểu → 422).
- [ ] Tạo `tests/conformance/business.test.ts`: state machine SC (tao→bat_dau→hoan_thanh→quyet_toan; chặn bước sai), ton kho âm, soft-delete, validation Zod.
- [ ] Tạo `tests/conformance/security.test.ts`: token giả mạo → 401, token hết hạn → 401, không token → 401, IDOR (kho sửa SC không thuộc quyền → 403).
- [ ] `package.json`: thêm scripts `test` (jest), `test:conformance`, `test:security`, `test:watch`; đảm bảo jest chạy được với `.env.test` (tạo `tests/conformance/.env.test` nếu cần, dùng dotenv).
- **Verify**: `npm test` → ~320 case pass (chạy DB thật qua `docker compose up -d`).

### A2 — Security-owner (port 3102) · files: `lib/rateLimit.ts` (mới), `middleware.ts` (mới), `next.config.js`
- [ ] `lib/rateLimit.ts`: in-memory rate limiter cho `/api/auth` login (vd 5 lần/5 phút/IP) + token bucket đơn giản, chặn brute-force.
- [ ] `middleware.ts`: chặn path public, thêm security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy` cơ bản), rate-limit login.
- [ ] `next.config.js`: thêm headers qua `async headers()` (không xung đột middleware) — chọn 1 cơ chế, tránh trùng.
- [ ] Kiểm tra không hardcode secret (`.env` only), SQL parameterized (đã đúng), input Zod (đã đúng).
- **Verify**: `npx tsc --noEmit` + `npm run build`; test login sai 6 lần → bị chặn 429.

### A3 — Observability-owner (port 3103) · files: `lib/logger.ts` (mới), `app/api/health/route.ts` (mới), `app/api/metrics/route.ts` (mới)
- [ ] `lib/logger.ts`: logger chuẩn INFO/WARN/ERROR (timestamp, level, module, message, id tương quan; giấu secret; `DEBUG` bật detail).
- [ ] `/api/health`: GET trả `{ok:true, db:'up', uptime, version}` — ping DB (`SELECT 1`); khi DB down → 503 `{ok:false}`.
- [ ] `/api/metrics`: Prometheus text format — counters (http_requests_total, login_fail_total, sc_created_total, rpc_errors_total) + histogram đơn giản (latency buckets).
- [ ] Gắn log INFO vào `login` thành công / tạo SC; ERROR vào exception (qua try-catch hiện có, không sửa core logic).
- **Verify**: `tsc` + build; gọi `/api/health` với DB up/down.

### A4 — Scripts-owner (port 3104) · files: `scripts/*` (mới toàn bộ)
- [ ] `scripts/cleanup_test.ts`: xóa bản ghi `is_test=1` cũ >1 ngày (7 bảng: sc, sc_vattu, sc_cong_viec, baogia, ho_so, xuat_kho, activity_log) + đếm số xóa + log.
- [ ] `scripts/setup_cron.sh`: cài cron 2:00 AM chạy cleanup + backup (đã có backup.sh Onpremise).
- [ ] `scripts/health_check.sh`: curl `/api/health`, exit code 0/1.
- [ ] `scripts/backup.sh`: pg_dump to `backups/cencom_$(date).sql` (giữ 7 bản gần nhất).
- **Verify**: `npx tsx scripts/cleanup_test.ts` chạy không lỗi; `bash -n` các .sh.

### A5 — CI-owner (port 3105) · files: `.github/workflows/ci.yml` (mới), `.github/workflows/uat-video.yml` (mới)
- [ ] `.github/workflows/ci.yml`: job trên ubuntu-latest — setup Node 20 + Postgres service (docker) → `npm ci` → `tsc --noEmit` → `jest` (với DATABASE_URL service) → `next build`. Cache node_modules.
- [ ] `.github/workflows/uat-video.yml`: chạy sau CI pass — `npm run record:ux` (script chờ A7) → upload `videos/*.webm` artifact → gửi narration (A7).
- [ ] Đảm bảo workflow dùng `.env.test` không lộ secret.
- **Verify**: parse YAML hợp lệ (không thể chạy full vì chưa push — báo cáo cách chạy).

---

## 3. WAVE B — GĐ3 KHỞI ĐỘNG (sau khi Wave A merge + test pass)

### B6 — Smoke-owner (port 3206) · files: `scripts/smoke.mjs` (mới)
- [ ] Smoke script: health → login (5 role) → list xe → tạo SC (xuong) → nhap kho (kho) → baogia (ketoan) → dashboard (giamdoc) → logout. FAIL nhanh nếu bất kỳ bước fail (exit 1).
- [ ] `package.json` script `smoke` (test-owner thêm).

### B7 — E2E-owner (port 3207) · files: `e2e/*.spec.ts`, `playwright.config.ts` (mới), `package.json` (devDep + script `test:e2e`)
- [ ] Playwright config (baseURL `http://localhost:3001`, webServer `npm run dev`).
- [ ] 5 spec: auth.spec (login/logout/role guard), sc.spec (flow SC), kho.spec, baogia.spec, dashboard.spec.
- [ ] Không dùng polling 45s; đợi element; dữ liệu test tự dọn (`is_test=1`).

### B8 — UAT-video-owner (port 3208) · files: `scripts/seed-demo-data.mjs`, `scripts/record-ux.mjs`, `scripts/make-narration.mjs`, `videos/` (output)
- [ ] `seed-demo-data.mjs`: sinh transaction thật (SC 5 xe, nhập/xuất kho, báo giá, hồ sơ) + set `must_change=0` cho admin demo.
- [ ] `record-ux.mjs`: Playwright `recordVideo` headful tour: login → dashboard → SC → Kho → Báo giá → Hồ sơ → realtime thử → logout (slowMo 120, 1440×900).
- [ ] `make-narration.mjs`: gTTS tiếng Việt giọng nữ miền Nam + ffmpeg merge phụ đề + âm thanh → `videos/uat-tour.mp4`.
- [ ] `docs/plan_ui/UX_REVIEW.md`: đánh giá theo rubric (flow, animation, delay, empty-state, error, responsive, contrast, realtime).
- **Verify**: `node scripts/record-ux.mjs` → file webm tồn tại; `make-narration` → mp4 có tiếng.

---

## 4. WAVE C — GĐ3 HOÀN THIỆN + RELEASE

- [ ] **C9 Docker**: bật Docker Desktop → `docker build -t cencom-v5 .` + `docker compose -f docker-compose.prod.yml up -d` → smoke chống.
- [ ] **C10 Audit**: `npm audit` — fix critical/high; `npm outdated` — báo cáo.
- [ ] **C11 Docs**: cập nhật `README.md` (deploy prod, CI, UAT), `CHANGELOG.md` v5.0.1.
- [ ] **C12 Release**: commit + tag `v5.0.0` (theo skill git-versioning) — CHỈ khi user yêu cầu.

---

## 5. BẢNG CHỦ QUYỀN FILE (tránh xung đột)

| File | Chủ |
|---|---|
| `tests/conformance/*`, `jest.config.js`, `tsconfig.test.json`, `package.json` | A1 (test) |
| `lib/rateLimit.ts`, `middleware.ts`, `next.config.js` | A2 (security) |
| `lib/logger.ts`, `app/api/health/*`, `app/api/metrics/*` | A3 (observability) |
| `scripts/cleanup_test.ts`, `scripts/setup_cron.sh`, `scripts/health_check.sh`, `scripts/backup.sh` | A4 (scripts) |
| `.github/workflows/*` | A5 (CI) |
| `scripts/smoke.mjs` | B6 (smoke) |
| `e2e/*`, `playwright.config.ts` | B7 (E2E) |
| `scripts/seed-demo-data.mjs`, `scripts/record-ux.mjs`, `scripts/make-narration.mjs`, `videos/`, `docs/plan_ui/UX_REVIEW.md` | B8 (video) |
| `Dockerfile`, `docker-compose.prod.yml`, `.dockerignore` | C9 (verify, chỉ đọc) |
| `README.md`, `CHANGELOG.md` | C11 (docs) |

---

## 6. TIÊU CHÍ HOÀN THÀNH (Definition of Done)

1. `npx tsc --noEmit` → 0 lỗi.
2. `npm run build` → PASS.
3. `npm test` → ~320 case pass, 0 false-positive (không còn `[200,404]`), 0 empty-test.
4. Rate-limit login hoạt động (429 sau 5 lần sai).
5. `/api/health` + `/api/metrics` trả đúng format.
6. `scripts/cleanup_test.ts` chạy sạch; cron/backup scripts có.
7. CI workflow tồn tại + YAML hợp lệ.
8. Smoke pass khi chạy.
9. E2E Playwright pass.
10. Video UAT có tiếng + UX_REVIEW.md.
11. npm audit không critical/high.
