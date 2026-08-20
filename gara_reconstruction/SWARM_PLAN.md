# SWARM_PLAN v3 — Kế hoạch giao hàng v5.0 (GPS + Git compliant)

> Cập nhật sau rà soát: tích hợp **công tác Git** (git-versioning) và **đối chiếu GPS**
> (vibe-deploy-checklist) vào từng bước. Dùng thực trạng repo làm nền.

---

## PHẦN 0 — THỰC TRẠNG & VỊ TRÍ GPS (bằng chứng từ git)

```
git log:  03594d4 v4.0.0 - full web app + UI/UX Pro Max + dark mode
          2e6a0ac GĐ2: Port packages/core (134 test pass)
          8c3f57e GĐ1: Schema PostgreSQL + Migrator + Seed
git tag:  v4.0.0
.env:     ✅ bị .gitignore chặn
gara_reconstruction/: ❌ UNTRACKED (chưa commit)
```

**Kết luận GPS**:
- Dự án HIỆN TẠI (v4.0.0) đã có full UI + 134 test → thực chất đang ở **GĐ3 (Production-capable)** nhưng mang theo **toàn bộ module đầy đủ** (baogia, de-xuat, dashboard, kho…).
- Mục tiêu lean = **REFACTOR-TO-LEAN** trên nền v4.0.0: cắt module nhiễu (scoring/asset/chat/preview/tk), thêm `activity_log`, chỉnh permission (giamdoc kiểm tra, admin ops).
- `gara_reconstruction/` là **THIẾT KẾ CHUẨN** (design spec), cần commit ngay.
- ⚠️ Nếu user muốn greenfield 100% (bỏ v4.0.0), các bước 2–5 đổi thành "xây mới" (như v1 của plan này).

---

## PHẦN 1 — QUY TRÌNH ĐÁNH GIÁ & KIỂM THỬ (mọi bước)

Plan → **TDD** → Execute → **Verify có bằng chứng**:
- `npx tsc --noEmit` + **ESLint** + `npm audit` (không critical/high)
- Unit (TDD) + Integration (`/api/rpc` từng vai) + Conformance (từ SCENARIOS)
- Security OWASP + **edge case** + **async/await check** + **logging levels**
- **Production Check 4 câu** + **Git gate** (commit + CHANGELOG + tag)

**Gate mỗi bước**: chỉ đóng khi verify + git gate xanh.

---

## PHẦN 2 — CÔNG TÁC GIT (git-versioning) — BẮT BUỘC

Áp dụng cho MỌI bước:
- **Baseline**: commit `gara_reconstruction/` (đang untracked) + đảm bảo `.gitignore` chặn `.env`/`*.db`/`*.log` (`git check-ignore -v .env`).
- **Mỗi bước**: sau verify gate → `git add .` → `git status` soát (KHÔNG .env/db/log) →
  `git commit -m "lean-GĐx: <mô tả>"`.
- **Milestone tag** (annotated): `v5.0.0-alpha` (xong GĐ2 lean), `v5.0.0-beta` (xong GĐ3),
  `v5.0.0` (release). Format `vX.Y.Z`.
- **CHANGELOG.md**: cập nhật mỗi milestone (đối chiếu số test pass, tính năng).
- 🔴 Red flag: commit `.env`, tag khi test chưa pass, amend commit đã tag.

---

## PHẦN 3 — 7 BƯỚC (refactor-to-lean trên nền v4.0.0)

| # | Bước | GPS | Git |
|---|---|---|---|
| 0 | Baseline: commit thiết kế + verify .gitignore | — | commit gara_reconstruction/ |
| 1 | Schema: thêm `activity_log` + `is_test`, cleanup cron | GĐ1 | commit + CHANGELOG |
| 2 | Core: trim module nhiễu + `activity.ts` + `perm.ts` (giamdoc/admin) | GĐ1 | commit |
| 3 | API: registry bỏ duyệt, thêm `activityFeed`, chỉnh quyền | GĐ1 | commit |
| 4 | UI: 4 vai (giamdoc feed, admin view+test), ẩn trang nhiễu | GĐ1 | commit |
| 5 | **Verification & Security** (GPS GĐ2 đầy đủ) | **GĐ2** | commit + tag alpha |
| 6 | **Deploy & Monitor** (GPS GĐ3 đầy đủ) | **GĐ3** | commit + tag beta/v5.0.0 |

---

## PHẦN 4 — ÁNH XẠ CHECKLIST GPS VÀO TỪNG BƯỚC

**GĐ1 (Dev) — các bước 0–4:**
- [x] Hiểu yêu cầu (đã đọc AGENTS.md + design)
- [x] Thiết kế duyệt (gara_reconstruction/ đã trình user)
- [x] Task nhỏ 5–15 phút (swarm decompose)
- [x] Test Strategy (unit/integration/conformance)
- [x] TDD logic cốt lõi (tính tiền, xuất kho fail, is_test)
- [x] Chạy local được (v4.0.0 sẵn có)
- [x] Không placeholder

**GĐ2 (Pre-deploy & Security) — BƯỚC 5 (TRƯỚC ĐÂY THIẾU):**
- [ ] **npm audit** — thêm (trước thiếu)
- [ ] **ESLint + Prettier** — thêm (trước chỉ tsc)
- [ ] **Security OWASP** — SQLi param, XSS escape, CSRF origin, IDOR, RBAC default-deny (skill `security-checklist`)
- [ ] **Secrets** — `.env` ignored ✅; verify không hardcode (grep)
- [ ] **Input Validation** — Zod (có); frontend whitelist
- [ ] **Edge Case** — input rỗng/dài/`<script>`/`' OR 1=1`; user A gọi API user B → 403; state sai → lỗi
- [ ] **Async/Await** — mọi Promise await, không fire-and-forget (Express wrapper bắt lỗi) — thêm check
- [ ] **Logging** — INFO/WARN/ERROR đúng mức; activity_log + error stack khi DEBUG — thêm

**GĐ3 (Production & Monitor) — BƯỚC 6 (TRƯỚC ĐÂY THIẾU):**
- [ ] **CI/CD** — thêm GitHub Actions (build+test+tsc) thay vì chỉ k6-nightly
- [ ] **Platform Deploy** — on-premise (skill `onpremise-deploy`) hoặc Vercel
- [ ] **Env Vars** — `.env` prod setup (Session secret, DB URL)
- [ ] **Observability** — error tracking (Sentry/LogRocket), perf, cost — thêm
- [ ] **Rollback** — git revert / DB backup / Docker rollback — thêm
- [ ] **Maintenance** — `npm outdated` định kỳ, patch bảo mật, review log — thêm

---

## PHẦN 5 — PHÂN TÍCH SWARM TỪNG BƯỚC (file-isolated)

> Cơ chế chống ghi đè: `swarmmail_reserve(paths)` khóa file; hoặc `swarm_worktree_create`
> mỗi agent 1 worktree. Orchestrator quyết định bước tiếp, KHÔNG viết code.

**B0 Baseline**: 1 agent commit `gara_reconstruction/` + verify `.gitignore`.

**B1 Schema**: 
- T1 `packages/db/schema.sql` thêm activity_log+is_test — A
- T2 `packages/db/src/cleanup_test.ts` cron — B
- T3 `packages/db/src/cli.ts` migrate — C
(Song song, file riêng)

**B2 Core (refactor)**:
- T1 `perm.ts` (giamdoc oversight + admin ops) — A **[competitive]**
- T2 `activity.ts` (ghi+feed) — B **[cốt lõi]**
- T3 disable scoring/asset/chat/preview/tk (xóa file/thêm flag) — C
- T4 `sc.ts`/`kho.ts` bỏ hàm duyệt — D
- T5 `baogia.ts`/`ho_so.ts` giữ, gắn perm — E
(Mỗi agent 1 file + test)

**B3 API**:
- T1 `rpc/route.ts` (router, bỏ duyệt, thêm activityFeed) — A
- T2 `rpcRegistry.ts` (32 fn + quyền mới) — B
- T3 `auth/route.ts` — C
- T4 integration test — D

**B4 UI**:
- T1 `app/(auth)/` — A
- T2 `app/(app)/giamdoc/` (dashboard+feed+report) — B **[trọng tâm]**
- T3 `app/(app)/xuong/`, `kho/`, `ketoan/` — C/D/E
- T4 `components/`+theme (reserve riêng) — F
- T5 ẩn/disabled trang nhiễu (scoring/asset/chat/preview/tk) — G

**B5 Verification (GĐ2)**:
- T1 `npm audit` + fix — A
- T2 ESLint + async/await check — B
- T3 OWASP review (worker-f) — C **[competitive]**
- T4 edge-case + conformance test — D
- T5 logging levels — E

**B6 Deploy (GĐ3)**:
- T1 CI/CD GitHub Actions — A
- T2 on-premise deploy (skill onpremise-deploy) — B
- T3 monitoring (Sentry) + rollback script — C
- T4 CHANGELOG + tag v5.0.0 + docs — D

---

## PHẦN 6 — ORCHESTRATOR & CÔNG CỤ

1. `swarm_init(isolation="reservation")`
2. `swarm_decompose(task, max_subtasks=10)` → subtask granular
3. `swarmmail_reserve(paths)` → mỗi agent 1 file riêng (chống ghi đè)
4. Spawn song song nhiều `task` (worker-a..h / general)
5. `swarm_status` / `swarmmail_inbox` theo dõi; **model rotation** >45s/lỗi (≤2 lần)
6. `swarm_review_feedback` (≤3 lần) agent chưa đạt
7. `swarm_worktree_merge` → verify → `swarm_complete` (gate tsc+test+git)
8. **Git gate**: Orchestrator yêu cầu commit + CHANGELOG mỗi bước; tag milestone

---

## PHẦN 7 — RỦI RO & XỬ LÝ

| Rủi ro | Xử lý |
|---|---|
| 2 agent đụng file | `swarmmail_reserve` / worktree |
| Quên commit .env | `git check-ignore -v .env` bắt buộc mỗi bước |
| Tag khi test chưa pass | git-versioning gate: DỪNG, báo user |
| Thiếu npm audit/ESLint | Bước 5 bắt buộc (GĐ2) |
| Không monitor/rollback | Bước 6 bắt buộc (GĐ3) |
| Refactor gãy module cũ | Conformance test từ SCENARIOS + integration từng vai |

> Kế hoạch đã GPS + Git compliant. Khi user duyệt, Orchestrator bắt đầu **B0 (baseline commit)**.
