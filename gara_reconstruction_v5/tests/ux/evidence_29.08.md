# Kiểm thử & GPS GĐ2 — 2026-08-29

Dự án: `gara_reconstruction_v5` (CencomOS Gara v5.0) — tính năng **Hồ sơ 8 bước sửa chữa** (checkHoSo, keHoachSave, kiemTuSave, nghiemThuSave, baogiaSave, scQuyetToan gate).

## Bảng kết quả verify (thực chạy)

| Hạng mục | Lệnh | Kết quả | Trạng thái |
|---|---|---|---|
| Type check | `npx tsc --noEmit` | 0 error | ✅ PASS |
| Lint (feature files) | `npm run lint` | 0 error 0 warning | ✅ PASS |
| Conformance (cách ly) | `npm run test:conformance` | **289 passed / 0 failed** (8 suites) | ✅ PASS |
| UX E2E (Playwright) | `node tests/ux/ho_so_10_scenarios.mjs` | **10 / 10 PASS** | ✅ PASS |
| Dependency audit | `npm audit --omit=dev` | 0 critical, 2 high (25 CVE tổng) | ⚠️ KNOWN |

## Chi tiết conformance (per-file isolated runner)

| Suite | Tests | Ghi chú |
|---|---|---|
| business.test.ts | 28 | + seed 8 bước cho `scQuyetToan` |
| ho_so.test.ts | 14 | **MỚI** — unit checkHoSo + 4 save-RPC |
| qc206_hoso.test.ts | 13 | **MỚI** — conformance QC206 ↔ checkHoSo |
| rateLimit.test.ts | 6 | unit lib/rateLimit |
| rbac.test.ts | 141 | ma trận 5 role × 28 fn |
| rpc.test.ts | 35 | + fix `scQuyetToan` (ketoan) |
| rpc_hoso.test.ts | 26 | **MỚI** — integration /api/rpc per role + edge |
| security.test.ts | 26 | OWASP: token forgery, IDOR, XSS, sanitize |

> **Quan trọng:** chạy `npm test` (gộp 1 process) sinh nhiễu chéo DB + rate-limit 429 → 3 suite fail.
> Do đó CI dùng `npm run test:conformance` (mỗi file 1 process + 1 server riêng) → XANH ổn định.

## GPS (Giai đoạn Phát triển) status

- **GĐ1 — Dev (Feature complete):** ✅ OK. Logic 8 bước nguyên vẹn, UI panel, deep-link, quyết toán gate.
- **GĐ2 — Security / Verify:**
  - ✅ OWASP hardening (T5): XSS escape export HTML, CSRF/Origin check có sẵn, IDOR (sc_id existence + RBAC default-deny), logging INFO/WARN/ERROR + redact secret.
  - ✅ Tests xanh (unit + integration + conformance + UX).
  - ✅ Mitigation: `next.config.js` `images.unoptimized: true` (chặn DoS Image Optimizer) + `docs/NEXT_UPGRADE_PLAN.md` chi tiết nâng 14→16. 25 CVE đã ghi nhận, chấp nhận rủi ro thấp trên LAN (có firewall), có kế hoạch nâng riêng.
- **GĐ3 — Deploy / Monitor / Rollback:** ✅ CI `.github/workflows/ci.yml` (tsc+lint+conformance+build+docker build) + `Onpremise/docs/MONITORING_ROLLBACK.md` + `healthcheck.sh`.

## File test / cấu hình đã thêm (cho GĐ2)

- `tests/conformance/ho_so.test.ts` (mới)
- `tests/conformance/rpc_hoso.test.ts` (mới)
- `tests/conformance/qc206_hoso.test.ts` (mới)
- `tests/conformance/business.test.ts`, `rpc.test.ts` (sửa seed 8 bước)
- `tests/ux/ho_so_10_scenarios.mjs` (đã có, 10/10)
- `.eslintrc.js`, `.prettierrc.json`, script `lint` (mới)
- `scripts/test-conformance.mjs`, script `test:conformance` (mới — CI gate)
- `lib/core/ho_so.ts`, `baogia.ts`, `sc.ts`, `lib/rpc.ts`, `middleware.ts`, `app/(app)/sc/page.tsx` (T5 hardening)

### MCP Server (31.08)

| Hạng mục | Kết quả | Trạng thái |
|---|---|---|
| Scaffold | `mcp-server/index.ts` + `auth.ts` + `tool-docs.ts` (3 part files, song ngữ vi/en) | ✅ |
| Auto-generate tools | Tool tự sinh từ `lib/rpc.ts` registry — 32/32 fn (14 READ + 18 WRITE), 4 OPEN loại khỏi MCP | ✅ |
| Auth service-account | `MCP_USER/MCP_PASS/MCP_ROLE` qua `.env.mcp`, fallback `.env.local` cho `DATABASE_URL/SESSION_SECRET` | ✅ |
| Write-allowlist | `MCP_WRITE_TOOLS=''` mặc định = chỉ đọc. `isWriteAllowed()` chặn WRITE trước khi chạm core | ✅ |
| Audit | Mọi lệnh ghi `activity_log` với `channel=mcp`, bao gồm fn/actor/role/result | ✅ |
| Docs song ngữ | `tool-docs.part1-3.ts` — mô tả vi/en cho 32 tool + example args | ✅ |
| Smoke test | 32 tools (version 5.0.0), startup docs-completeness gate | ✅ |
| Conformance | 289/289 → **296/296** xanh (thêm 7 MCP test) | ✅ |
| Status M1 | **HOÀN THÀNH** | ✅ |

## Rủi ro còn lại & đề xuất

1. **Nâng Next.js 14 → 16** (riêng biệt, có test regression) để dọn 21 CVE.
2. `npm test` gộp chung không ổn định → **chỉ dùng `npm run test:conformance`** làm gate chính thức.
3. Thêm cleanup `is_test` data định kỳ (script `cleanup` đã có).
