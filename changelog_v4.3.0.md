# Changelog — cencomOS Gara v4.3.0 (Workspace & Truy xuất nội bộ)

> **Ngày tạo bản nháp:** 2026-08-17
> **Tác giả:** Gatekeeper (AI build agent)
> **Trạng thái:** ĐANG THỰC THI — Giai đoạn A (Workspace infra + View-only) + Giai đoạn B (Backend gap TDD) ĐÃ CODE & TEST XANH. C (dashboards) đang làm. D/E chưa làm.
> **Bản đồ chi tiết:** `plan_4workspace/TASKS_DETAILED.md` (neo bộ nhớ, task hạt giống 5–15 phút).
> **Quy tắc cứng:** `plan_4workspace/ai_config.yaml` (INV1–INV6: không đổi contract/schema/ RBAC cũ, chỉ ADD; validate backend; async await; không hardcode secret).

## 1. Mục tiêu v4.3
Trên 1 core duy nhất, xây **4 workspace giao diện** (Xưởng / Kho & Mua / Kế toán / Quản trị)
phục vụ từng nhóm công việc, clone phong cách UI (CarDoctor trắng-đen excel-like, VC Garage
mobile blue), bổ sung **Giám đốc view-only (PA1)** và khối **Sổ chi thu nội bộ**, lấp lỗ hổng
truy vết (XNT, lịch sử vật tư, proposal, scoring, bảo dưỡng).

## 2. Đã thực hiện (Giai đoạn A — code, chưa build)
| Mã | File | Nội dung |
|----|------|----------|
| A1 | `apps/web/components/WorkspaceContext.tsx` | ws + editMode, filter perms, persist localStorage + URL `?ws=`, đồng bộ theo pathname |
| A2 | `apps/web/components/WorkspaceSelector.tsx` | dropdown 4 ws gắn Topbar, filter perms |
| A3 | `apps/web/components/SubNav.tsx` | sub-nav chuẩn hóa, check quyền từng item |
| A4 | `apps/web/components/ui/ExcelTable.tsx` | sort/filter/pagination client + realtime reload |
| A5 | `apps/web/components/Sidebar.tsx` | nhóm theo ws, chỉ hiện ws hiện tại (R1 ẩn cross-ws) |
| A6 | `apps/web/app/globals.css` + `WorkspaceTheme.tsx` + `Shell.tsx` + `Topbar.tsx` | theme `[data-ws]` (xuong blue / kho+ketoan green / quantri giữ nguyên), set `data-ws` body, wire Provider |
| A7 | `apps/web/components/ReadOnlyGuard.tsx` + `WorkspaceContext` + `Topbar.tsx` | view-only PA1: editMode default false (giamdoc), ReadOnlyGuard, nút "Bật chỉnh sửa" + modal |
| — | `packages/db/src/accounting.sql` | ADD `so_quy`, `sc_phuong_an`, `xe_danh_gia`, `bao_duong_lich`, `sc.hinh_anh TEXT[]` (idempotent) |

**Bằng chứng:** `cd apps/web && npx tsc --noEmit` → **0 lỗi** (A1–A7). `npm run build` (web) → **PASS** (2026-08-17, toàn bộ route kể cả `ke-toan/*` compile xanh).

## 2b. Đã thực hiện (Giai đoạn B — Backend gap TDD, ĐÃ CODE & TEST XANH)

> Tất cả function dùng `checkLock`/RBAC đúng module, SQL parameterized `$1`, transaction + `audit` + soft-delete.
> Schema mới ADD vào CẢ `schema.sql` (PGlite test) và `accounting.sql` (Postgres).

| Mã | File | Nội dung | Test |
|----|------|----------|------|
| B1 | `packages/db/schema.sql` | ADD `so_quy`, `sc_phuong_an`, `xe_danh_gia`, `bao_duong_lich`, `phieu_sua.hinh_anh TEXT[]` (idempotent) | — |
| B2 | `packages/core/src/kho.ts` | `tonKhoReport` (XNT tồn đầu/cuối, nhập/xuất) | `kho-gd4.test.ts` 5/5 |
| B3 | `packages/core/src/kho.ts` | `vatTuHistory` (lịch sử vật tư nhập/xuất) | (như trên) |
| B4 | `packages/core/src/kho.ts` | `phChuyenKhoCreate` (chuyển kho, transaction rollback thiếu tồn) | (như trên) |
| B5 | `packages/core/src/ledger.ts` | `phieuThuCreate` (sổ quỹ: Nợ 111/112, Có 331/334/421, KHÔNG doanh thu/AR) | `ledger-gd4.test.ts` 4/4 |
| B6 | `packages/core/src/ketoan.ts` | `ledgerReport` mở rộng `so_quy` (thu/chi) | (như trên) |
| B7 | `packages/core/src/sc.ts` | `scProposalSave`/`scProposalList` (phương án sửa chữa → `sc_phuong_an`) | `sc-gd4.test.ts` 5/5 |
| B8 | `packages/core/src/xe.ts` | `xeScoreSave`/`xeScoreGet` (đánh giá xe → `xe_danh_gia`) | `xe-gd4.test.ts` 5/5 |
| B9 | `packages/core/src/baoduong.ts` (mới) | `baoDuongTao`/`baoDuongList` (lịch bảo dưỡng → `bao_duong_lich`) | `baoduong-gd4.test.ts` 4/4 |
| B10 | `packages/core/src/search.ts` | `globalSearch` thêm `vattu` (tìm kiếm vật tư) | `search.test.ts` PASS |
| B11 | `packages/contract/src/schemas.ts` + `apps/web/lib/rpc-dispatch.ts` + `packages/core/src/index.ts` | Zod cho 10 RPC mới; `RPC_META`/`ADMIN_ONLY`/`PREVIEW_MUTATION_BLOCK`; export `baoduong` namespace; INV3 không đổi `can()` | `contract.test.ts` PASS |
| B12 | (toàn bộ) | `npx vitest run` core = **316 PASS**; `contract.test.ts` PASS; `tsc --noEmit` core = 0 lỗi | ✅ |

**Ghi chú quan trọng (phát hiện khi debug test PGlite):**
- `schema.sql` là file **CRLF**; `parseSchema` test helper bị lỗi nhận diện kết thúc statement khi có `;-- ` comment cuối dòng → gộp statement. Đã sửa `helpers.ts` chuẩn hóa CRLF + bỏ comment `--` cuối dòng.
- Bảng header SC thực tế là **`phieu_sua`** (không phải `sc` — `sc` chỉ là tên module). ALTER ban đầu nhầm `sc.hinh_anh` → đã sửa thành `phieu_sua.hinh_anh` trong cả `schema.sql` và `accounting.sql`.
- `vattu.id` là **BIGINT** → `upper(id)` lỗi; search dùng `upper(id::text)`.

## 2c. Đã thực hiện (Giai đoạn C — Dashboards / UI, ĐÃ CODE, web `tsc --noEmit` 0 lỗi)

| Mã | File | Nội dung |
|----|------|----------|
| C1 | `apps/web/components/ui/ChartCard.tsx` | Card biểu đồ SVG tự vẽ (pie/bar), không dependency ngoài |
| C2 | `apps/web/app/(app)/kho/page.tsx` | Thay `KhoNav`→`SubNav` (KHO_NAV); thêm summary cards + ChartCard "Tồn kho theo nhóm" (tính từ vatTuList) |
| C3 | `apps/web/app/(app)/ke-toan/dashboard/page.tsx` | Thêm `useRpc('ledgerReport')` → cards Thu/Chi nội bộ + ChartCard pie cơ cấu Thu/Chi; gắn `data-ws="ketoan"` |
| C5 | `apps/web/components/KeToanNav.tsx` (xóa dùng) + `apps/web/lib/nav-items.ts` + 4 trang ke-toan | Thay `KeToanNav` bằng `SubNav` chuẩn hóa (perm gated) trên toàn module Kế toán; nav chung tái dùng (KETOAN_NAV/KHO_NAV/XUONG_NAV) |

> Lưu ý: C5 phần "In A4 header theo ws" chưa làm (chỉ thay nav). Cần bổ sung trong E nếu yêu cầu.

## 3. Kế hoạch còn lại (thứ tự thực thi)
1. ~~**A8** — `npm run build` (web) chốt P1/P5~~ → đã PASS (2026-08-17, build web toàn route).
2. ~~**B1→B12** — Backend gap TDD~~ → ĐÃ CODE & TEST (316 vitest pass, contract pass).
3. ~~**C1→C5** — Dashboards~~ → C1/C2/C3/C5(xóa KeToanNav) DONE; C5 "In A4 theo ws" CHƯA; chưa dùng ExcelTable (dùng tbl thường).
4. **D1→D4** — Mobile Xưởng (BottomNav + FAB, Kanban realtime, ảnh hiện trường `phieu_sua.hinh_anh`).
5. **E1→E5** — Build/contract/E2E 375px + VIDEO UIUX / docs / CHANGELOG chốt (A8 build lại sau D).

## 4. Quyết định lệch thiết kế (ghi nhận)
- **ChartCard = SVG tự vẽ** (pie/bar) thay Recharts → tránh rủi ro dependency/build.
- **editMode ở WorkspaceContext** thay SessionContext → tránh context ordering conflict.
- **Audit log bật editMode = console.info** (vì PA1.backend_change=none), chưa thêm RPC write-audit.
- **nav chung** `lib/nav-items.ts` tái dùng SubNav thay mỗi module tự viết nav riêng.

## 5. Rủi ro
- R1 (IDOR): code xong (A1/A5), cần test E3.
- R2 (giám đốc sửa nhầm): code xong (A7), cần test E3.
- R3 (ExcelTable treo): pagination client đủ với dữ liệu vừa.
- R5 (mobile): chưa làm (D) → E3.
- R6 (pha trộn theme): `data-ws` isolate, badge giữ nguyên.
- R7 (so_quy sai kỳ): `ledgerReport` so_quy lọc theo ngay BETWEEN → cần test E3 thực tế.

---

⚠️ **Lưu ý hệ thống sản xuất (Production Check):**
- **Còn thiếu gì?** D1–D4 (mobile Xưởng); C5 "In A4 theo ws"; E1–E5 (build lại, E2E video, docs).
- **Rủi ro ở đâu?** D (mobile nav/FAB/ảnh upload) chưa có; E3 (video 375px) chưa quay; so_quy cần dữ liệu thực tế xác minh.
- **Đã chạy kiểm thử chưa?** Core vitest **316 PASS** (B); web `tsc --noEmit` **0 lỗi** (A+C). Chưa E2E.
- **Đề xuất tiếp theo?** Làm **D1/D2** (BottomNav + FAB + gắn layout mobile ws=xuong), rồi **D3** (Kanban realtime), **D4** (ảnh hiện trường), cuối cùng **E1** build + **E3** E2E video.
