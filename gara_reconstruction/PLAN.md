# KẾ HOẠCH THIẾT KẾ TỪNG BƯỚC — cencomOS Garage v5.0 (LEAN)

> **Phiên bản**: v5.0.0 — bản lean rebuild từ v4.0.0, thiết kế ngược từ 4 vai + theo dõi.
> **Chuẩn thiết kế**: thư mục `gara_reconstruction/` (README, SCENARIOS, DOMAIN, SCHEMA, API, DIAGRAM, GAP_ANALYSIS, SWARM_PLAN).
> **Nguyên tắc**: mỗi bước = 1 wave Swarm, file-isolation (không ghi đè), gate verify + git trước khi đóng.

---

## 0. BỐI CẢNH & MỤC TIÊU

- **Thực trạng**: repo đã có `v4.0.0` (full UI, 134 test). Nhưng mang quá nhiều module nhiễu.
- **Mục tiêu v5.0**: cắt gọn còn **4 vai + theo dõi**, giữ báo giá (8 bước), thêm `activity_log`.
- **GPS**: v5.0 bắt đầu từ việc **refactor v4.0.0** (GĐ1 sẵn có) → qua GĐ2 (security) → GĐ3 (deploy/monitor).

---

## 1. YÊU CẦU MỚI ĐÃ CHỐT (cơ sở thiết kế)

| # | Yêu cầu | Quyết định thiết kế |
|---|---|---|
| 1 | Báo giá cần thiết (8 bước) | **GIỮ** `baogia` + `baogia_chitiet` |
| 2 | Scoring ẩn | ⏸️ DEFER (không tạo bảng, không UI) |
| 3 | Asset ẩn | ⏸️ DEFER |
| 4 | Chữ ký → activity_log | ✅ **BỎ** `nhanKy`, thay `activity_log` |
| 5 | Ẩn chat/preview/thăm khám/bot | ⏸️ DEFER |
| 6 | Bỏ duyệt + ngưỡng (thủ công) | ✅ **BỎ** `scDuyet`/`dmDuyet`/threshold |
| 7 | Giám đốc = quyền kiểm tra | ✅ **XEM MỌI THỨ** + activityFeed + report |
| 8 | Admin = quản trị mạng | ✅ **CHỈ XEM** + test-create (`is_test=1`, lưu 1 ngày) |

**4 vai + admin**: `giamdoc`(kiểm tra) · `xuong`(lập/sửa) · `ketoan`(hồ sơ) · `kho`(mua) · `admin`(ops).

---

## 2. KẾ HOẠCH THIẾT KẾ TỪNG BƯỚC (7 BƯỚC)

### BƯỚC 0 — Baseline & Thiết kế (Git)
- **Thiết kế**: commit toàn bộ `gara_reconstruction/` (đang untracked).
- **Gate**: `git check-ignore -v .env` ✅; không commit `.env`/`*.db`/`*.log`.
- **Git**: `git commit -m "v5.0-design: lean 4-vai + theo dõi (gara_reconstruction)"`.
- **Swarm**: 1 agent commit + verify.

### BƯỚC 1 — Schema v5.0 (GĐ1)
- **Thiết kế** (theo `SCHEMA.md`):
  - Giữ: xe, sc, sc_congviec, sc_vattu, vattu, nhap_xuat, dm, dm_chitiet, users, config.
  - Thêm: `baogia`+`baogia_chitiet` (giữ 8 bước), `activity_log` (theo dõi), `ho_so` (kế toán).
  - Thêm cờ `is_test` (7 bảng) + cron tự xoá sau 1 ngày.
  - **BỎ**: bảng scoring, asset, nhanKy, chat, tk (không tạo).
  - SC state: `de_xuat→dang_sua→da_hoan→da_quyet` (không `da_duyet`).
- **Git**: commit + CHANGELOG "Schema v5.0".
- **Swarm**: 4 agent song song (schema.sql / cleanup_test / cli.migrate / seed), file riêng.

### BƯỚC 2 — Core logic (GĐ1, TDD)
- **Thiết kế** (theo `DOMAIN.md`):
  - `perm.ts`: giamdoc=XEM MỌI THỨ; admin=XEM+test; xuong/ketoan/kho=quyền module.
  - `activity.ts`: ghi log mọi hành động + query feed (filter role/xe/ngay/loai) ⭐.
  - `sc.ts`/`kho.ts`: **bỏ hàm duyệt**; tính tiền giữ nguyên; xuất kho fail nếu thiếu.
  - `baogia.ts`/`ho_so.ts`: giữ, gắn perm (ketoan quản lý, giamdoc xem).
  - Trim: vô hiệu scoring/asset/chat/preview/tk (xóa file hoặc flag).
- **Git**: commit từng module.
- **Swarm**: 10 agent, mỗi người 1 file `packages/core/src/X.ts` + `X.test.ts` (TDD). `perm.ts`/`activity.ts` dùng competitive mode.

### BƯỚC 3 — API /api/rpc (GĐ1)
- **Thiết kế** (theo `API.md`, ~32 RPC):
  - Router duy nhất `POST /api/rpc`, CSRF, default-deny (rpcMeta).
  - **BỎ** `scDuyet`/`dmDuyet`; **THÊM** `activityFeed`, `dashboard`, `reportSummary`.
  - Quyền: giamdoc xem mọi thứ; admin xem+test; 4 vai nghiệp vụ ghi module mình.
- **Git**: commit.
- **Swarm**: 4 agent (rpc/route, auth/route, rpcRegistry, integration test), file riêng.

### BƯỚC 4 — UI 4 vai (GĐ1)
- **Thiết kế** (theo `DIAGRAM.md` + `SCENARIOS.md`):
  - `giamdoc`: dashboard quan sát (KPI) + Activity Feed (filter) + Report ⭐.
  - `admin`: view-only + nút "tạo test" (is_test=1, cảnh báo lưu 1 ngày).
  - `xuong`: dashboard xưởng + SC list/detail/create + bắt đầu/hoàn thành/từ chối.
  - `ketoan`: hồ sơ + báo giá + quyết toán.
  - `kho`: vật tư + nhập/xuất + DM.
  - **ẨN**: trang scoring/asset/chat/preview/tk (disabled hoặc xóa route).
- **Git**: commit từng route folder.
- **Swarm**: 6 agent (auth/xuong/kho/ketoan/giamdoc/components), mỗi người 1 route folder; `components/` reserve riêng.

### BƯỚC 5 — Verification & Security (GĐ2 — GPS BẮT BUỘC)
- **Thiết kế kiểm thử** (theo GPS GĐ2):
  - `npm audit` → không critical/high.
  - ESLint + Prettier + `tsc --noEmit`.
  - OWASP: SQLi(param), XSS(escape), CSRF(origin), IDOR(quyền sở hữu), RBAC(default-deny).
  - Edge case: input rỗng/dài/`<script>`/`' OR 1=1`; user A gọi API user B → 403; state sai → lỗi.
  - Async/Await: mọi Promise await, Express wrapper bắt lỗi, không fire-and-forget.
  - Logging: INFO/WARN/ERROR đúng mức + activity_log.
  - Conformance: từ `SCENARIOS.md` (MSS=happy, Extensions=lỗi).
- **Git**: commit + **tag `v5.0.0-alpha`**.
- **Swarm**: 5 agent (audit/eslint/OWASP-review/conformance/logging), competitive cho review.

### BƯỚC 6 — Deploy & Monitor (GĐ3 — GPS BẮT BUỘC)
- **Thiết kế triển khai** (theo GPS GĐ3):
  - CI/CD: GitHub Actions (build+test+tsc) thay vì chỉ k6-nightly.
  - Deploy: on-premise (Docker+Nginx+self-signed) hoặc Vercel.
  - Env: `.env` prod (Session secret, DB URL) — không hardcode.
  - Observability: Sentry/error tracking + perf + cost.
  - Rollback: git revert / DB backup / Docker rollback.
  - Maintenance: `npm outdated` định kỳ, patch bảo mật.
- **Git**: commit + **tag `v5.0.0-beta`** → **`v5.0.0`** (release).
- **Swarm**: 4 agent (CI/CD, deploy, monitor+rollback, CHANGELOG+tag).

---

## 3. ÁNH XẠ GPS & GIT

| Bước | GPS | Git tag |
|---|---|---|
| 0 | — | commit design |
| 1–4 | **GĐ1 Dev** | commit từng bước |
| 5 | **GĐ2 Security** | `v5.0.0-alpha` |
| 6 | **GĐ3 Production** | `v5.0.0-beta` → `v5.0.0` |

> Chi tiết phân rã Swarm (agent, file, cơ chế chống ghi đè) xem `SWARM_PLAN.md`.

---

## 4. RỦI RO & XỬ LÝ
- Refactor gãy module cũ → Conformance + integration test từng vai.
- Quên commit `.env` → `git check-ignore -v .env` mỗi bước.
- Tag khi test chưa pass → DỪNG (git-versioning gate).
- is_test lọt report → `report.ts` lọc `is_test=0`.
- Thiếu monitor/rollback → Bước 6 bắt buộc (GĐ3).

> Kế hoạch sẵn sàng. Bạn duyệt → Orchestrator bắt đầu **Bước 0 (baseline commit)**.
