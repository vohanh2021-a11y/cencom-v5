# KẾ HOẠCH HARDENING — GIAI ĐOẠN 2 (còn lại) + GIAI ĐOẠN 3

**Dự án:** cencomOS Gara v5 (`gara_reconstruction_v5`)
**Ngày:** 2026-08-21
**Người điều phối:** Orchestrator (chế độ Dieu Phoi / Swarm)
**Mục tiêu:** Đưa app từ cuối GĐ1 / đầu GĐ2 sang sẵn sàng production: dọn sạch security gaps, thiết lập CI/CD, deploy (on-premise/cloud), monitoring, rollback.

---

## 1. GPS hiện tại (bằng chứng)

- ✅ Conformance **236/236**, smoke PASS, e2e PASS, UAT video `videos/uat-tour.mp4` (1.68 MB)
- ✅ `npx tsc --noEmit` = **0 lỗi** (đã sửa `utf16be` → `swap16`)
- 🔴 `npm audit`: **2 high** (`next` + `postcss` transitive) — đã patch 14.2.35; dọn sạch triệt để chỉ ở **Next 16** (breaking change)
- ❌ CI/CD: chưa | ❌ Monitoring: chưa | ❌ Deploy prod: chưa (có sẵn thư mục `Onpremise/`)

---

## 2. Workstreams (7 luồng — chạy song song)

### Wave 1 — độc lập, rủi ro thấp (6 luồng song song)

| WS | Việc | Agent | File scop |
|----|------|-------|-----------|
| WS1 | OWASP security review (RPC / auth / RBAC / input validation) | worker-f | `docs/SECURITY_REVIEW.md` (+ sửa nhỏ nếu có) |
| WS2 | CI/CD GitHub Actions (ci + deploy skeleton) | worker-c | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` |
| WS3 | Fix cảnh báo DEP0190 (shell:true trong setup.ts) | worker-d | `tests/conformance/setup.ts` |
| WS4 | Production docs (.env example, PRODUCTION.md, CHANGELOG) | worker-b | `docs/PRODUCTION.md`, `.env.production.example`, `CHANGELOG.md` |
| WS5 | Monitoring / observability scaffolding | worker-c | `lib/observability.ts`, `docs/MONITORING.md` |
| WS6 | On-premise deploy verify | worker-g | `Onpremise/*` + `Onpremise/README_VERIFIED.md` |

### Wave 2 — rủi ro cao, worktree riêng

| WS7 | Next.js 14 → 16 upgrade (worktree `next16-upgrade`) | worker-e | `package.json`, `next.config.*`, `app/**`, `lib/**` |
|-----|------------------------------------------------------|----------|------------------------------------------------------|

**Gate WS7:** `tsc --noEmit` = 0 + `npm run test:ci` = 236/236 + `npm run e2e` pass.
**Fallback WS7:** revert worktree, restore 14.2.35, viết `docs/SECURITY_NEXT16_RISK.md` ghi nhận rủi ro dư (app nội bộ/intranet).

---

## 3. Quy tắc tránh xung đột

- WS1–6 **KHÔNG commit/push** (chỉ sửa file; orchestrator commit cuối cùng).
- WS7 làm trong **git worktree** (cách ly hoàn toàn khỏi working tree chính).
- **Chỉ WS7** được chạy `npm run test:ci` / `npm run e2e` (tránh DROP SCHEMA đồng thời trên DB + clash port 3001).
- Các agent khác **KHÔNG chạy** `npm run test:ci`.
- Mỗi agent chỉ sửa file thuộc scop của nó (xem bảng trên).

---

## 4. Verification gates (orchestrator chạy SAU CÙNG CÙNG, 1 lần duy nhất)

- `npx tsc --noEmit` = 0
- `npm run test:ci` = 236/236
- `npm run e2e` = pass
- `npm audit` = 0 high (nếu WS7 xanh) HOẶC risk documented
- CI yaml hợp lệ; Onpremise config verified; docs đầy đủ

---

## 5. Rủi ro & fallback

- WS7 breaking → revert worktree + document residual risk (app nội bộ/intranet, ảnh hưởng thấp).
- Agent trả về rỗng → orchestrator tự làm hoặc re-run.
- Postgres container `cencom_v5_pg` phải chạy (WS7 cần cho test).

---

## 6. Báo cáo

- Tổng hợp kết quả từng WS, evidence, còn thiếu gì, đề xuất bước tiếp theo.
