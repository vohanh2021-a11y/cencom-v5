# TASKS_DETAILED — Bản đồ thực thi hạt giống v4.3 Workspace

> **Mục đích:** Chia nhỏ kế hoạch v4.3 (P1–P6) thành nhiệm vụ 5–15 phút, có thứ tự,
> có file tác động, input/output, cách chứng minh (test/build), và trạng thái.
> Đây là **neo bộ nhớ duy nhất** — mỗi phiên làm việc đọc file này trước, tick tiếp, không lạc đề.
>
> **Quy tắc bất di bất dịch (từ ai_config.yaml):** KHÔNG đổi contract RPC cũ (chỉ ADD),
> KHÔNG đổi schema cũ (chỉ ADD bảng), KHÔNG đổi `can()`, validate+sanitize backend,
> async await đủ, không hardcode secret.
>
> **Trạng thái legend:** `[x]` đã xong + có bằng chứng | `[~]` đã code, chờ verify | `[ ]` chưa làm

---

## GIAI ĐOẠN A — NỀN TẢNG WORKSPACE (P1 + P5) — đang chốt verify

| Mã | Thuộc | Mô tả chi tiết | File tác động | Input/Output | Chứng minh | Trạng thái |
|----|-------|----------------|---------------|--------------|------------|------------|
| A1 | P1.1 | Tạo `WorkspaceContext` (ws + editMode, filter perms, persist localStorage + URL `?ws=`, đồng bộ theo pathname) | `components/WorkspaceContext.tsx` | props: role, perms / output: context {ws,setWs,allowed,editMode,...} | tsc web = 0 | [x] |
| A2 | P1.2 | `WorkspaceSelector` dropdown 4 ws, gắn Topbar, filter perms | `components/WorkspaceSelector.tsx` | - | tsc | [x] |
| A3 | P1.3 | `SubNav` chuẩn hóa, check quyền từng item (thay KeToanNav/KhoNav) | `components/SubNav.tsx` | items:[{href,label,perm?}] | tsc | [x] |
| A4 | P1.4 | `ExcelTable` (sort click cột, filter inline, pagination client, realtime reload tùy chọn) | `components/ui/ExcelTable.tsx` | columns,rows,rowKey | tsc | [x] |
| A5 | P1.5 | Sidebar refactor: nhóm theo ws, chỉ hiện ws hiện tại, ẩn cross-ws | `components/Sidebar.tsx` | navItems (từ server) | tsc | [x] |
| A6 | P1.6 | `globals.css` theme `[data-ws]` (xuong blue / kho+ketoan green / quantri giữ nguyên) + `WorkspaceTheme` set `data-ws` trên body + style subnav/excel/ws-select/bottom-nav/fab/view-only | `app/globals.css`, `components/WorkspaceTheme.tsx`, `components/Shell.tsx` (import+wrap Provider), `components/Topbar.tsx` (import Selector) | - | tsc | [x] |
| A7 | P5 | View-only PA1: `editMode` trong WorkspaceContext (default false nếu giamdoc) + `ReadOnlyGuard` disable form + Topbar nút "Bật chỉnh sửa" + modal xác nhận | `components/ReadOnlyGuard.tsx`, `WorkspaceContext.tsx`, `Topbar.tsx`, `globals.css`(`.view-only`) | - | tsc | [x] |
| A8 | P1.Gate | VERIFY build web: `cd apps/web && npm run build` phải pass (bắt lỗi runtime import, JSX) | - | - | build success | [x] |

> **Ghi chú A:** code A1–A7 đã viết xong, `npx tsc --noEmit` (web) = 0 lỗi. Còn A8 (build) chưa chạy.
> Schema mới (so_quy, sc_phuong_an, xe_danh_gia, bao_duong_lich, sc.hinh_anh) đã thêm vào `packages/db/src/accounting.sql` NHƯNG **chưa thêm vào `packages/db/src/schema.sql`** (dùng cho test PGlite) → sẽ làm ở B1.

---

## GIAI ĐOẠN B — BACKEND GAP + SỔ QUỸ (P4, TDD từng hàm)

> Nguyên tắc: mỗi hàm viết TEST RED trước → implement GREEN → chạy lại. File test mới: `packages/core/tests/ketoan-gd4p.test.ts`.

| Mã | Thuộc | Mô tả | File | Input/Output | Chứng minh | Trạng thái |
|----|-------|-------|------|--------------|------------|------------|
| B1 | P4.0 | Thêm bảng mới vào **CẢ** `schema.sql` (PGlite test) idempotent: so_quy, sc_phuong_an, xe_danh_gia, bao_duong_lich, ALTER sc.hinh_anh TEXT[] | `packages/db/src/schema.sql` | - | vitest chạy được | [ ] |
| B2 | P4.1.1 | `tonKhoReport(from,to)` — XNT tổng hợp (tồn đầu, nhập, xuất, tồn cuối theo vật tư) | `kho.ts` | {from,to} → rows[{vattu,ton_dau,nhap,xuat,ton_cuoi}] | test RED→GREEN | [ ] |
| B3 | P4.1.2 | `vatTuHistory(id)` — lịch sử nhập/xuất 1 vật tư (join phieu_nhap_ct/phieu_xuat_ct) | `kho.ts` | vattu_id → rows[{ngay,loai,so_luong,ct_id}] | test | [ ] |
| B4 | P4.1.4 | `phChuyenKhoCreate` — chuyển kho nội bộ (không đổi tiền): giảm tồn kho A, tăng B, ghi audit | `kho.ts` | {vattu_id,sl,tu_kho,den_kho} → {ok,id} | test (rollback nếu slâng) | [ ] |
| B5 | P4.3.1 | `phieuThuCreate` — thu nội bộ (so_quy): Nợ 111/112, Có 331/334/421; KHÔNG doanh thu/AR | `ledger.ts` | {ngay,loai_quy,doi_tac,so_tien,ly_do,ref_id} → {ok,id} + post ledger | test (chặn âm, chặn thiếu quyền) | [ ] |
| B6 | P4.3.2 | Mở rộng `ledgerReport` thêm phần Sổ quỹ (tổng thu/chi theo kỳ) | `ketoan.ts` | báo cáo có them so_quy | test | [ ] |
| B7 | P4.2.1 | `scProposalSave` / `scProposalList` — proposal A/B/C gắn SC | `sc.ts` | {sc_id,ten,mo_ta,chi_phi_uoc_tinh} → {ok,id} | test | [ ] |
| B8 | P4.2.3 | `xeScoreSave` / `xeScoreGet` — gắn engine `scoring.ts` vào `xe_danh_gia` | `xe.ts` | {xe_id,diem,xep_loai,ghi_chu} → {ok,id} | test (A–E hợp lệ) | [ ] |
| B9 | P4.2.4 | `baoDuongTao` / `baoDuongList` — lịch bảo dưỡng định kỳ | `baoduong.ts` (mới) | {xe_id,hang_muc,ngay_du_kien} → {ok,id} | test | [ ] |
| B10 | P4.1.3 | `search.ts` mở rộng index `vattu` (tra mã phụ tùng) | `search.ts` | query → kết quả vattu | test | [ ] |
| B11 | P4.Contract | Zod + `RPC_SCHEMAS` cho các hàm B2–B9; meta `rpc-dispatch.ts` + `perm.ts` MATRIX (kho/ke_toan/quanly) | `packages/contract/src/schemas.ts`, `apps/web/lib/rpc-dispatch.ts`, `packages/core/src/perm.ts` | - | contract test | [ ] |
| B12 | P4.Gate | VERIFY: `cd packages/core && npx vitest run` pass + `npm run test:contract` pass | - | - | 273+ mới pass | [ ] |

---

## GIAI ĐOẠN C — CLONE CARDOCTOR (P2: Kho & Kế toán dashboards)

| Mã | Thuộc | Mô tả | File | Chứng minh | Trạng thái |
|----|-------|-------|------|------------|------------|
| C1 | P2.0 | `ChartCard` (SVG nhẹ: pie + bar, KHÔNG recharts để tránh dep-risk — ghi chú deviation) | `components/ui/ChartCard.tsx` | tsc | [ ] |
| C2 | P2.1 | Kho dashboard: `ExcelTable` tồn kho (highlight thiếu) + `ChartCard` cảnh báo thiếu + `SubNav` Kho | `app/(app)/kho/page.tsx` | tsc + build | [ ] |
| C3 | P2.2 | Kế toán dashboard: `ChartCard` CĐKT pie + chi phí bar + `ExcelTable` chứng từ gần nhất | `app/(app)/ke-toan/dashboard/page.tsx` | tsc + build | [ ] |
| C4 | P2.3 | Thay `KeToanNav` bằng `SubNav` trong 5 trang ke-toan; SubNav Kho trong trang kho/baogia/thanhly | các page ke-toan/kho | tsc | [ ] |
| C5 | P2.5 | In A4 (`/in/*`) header theo workspace (đọc data-ws) | `app/(app)/in/*` | tsc | [ ] |

---

## GIAI ĐOẠN D — CLONE VC GARAGE MOBILE (P3: Xưởng)

| Mã | Thuộc | Mô tả | File | Chứng minh | Trạng thái |
|----|-------|-------|------|------------|------------|
| D1 | P3.2 | `BottomNav` (Home/SC/Đề xuất/Kho/Chat) + `FAB` tạo lệnh — chỉ hiển thị khi `data-ws=xuong` & mobile | `components/BottomNav.tsx`, `components/Fab.tsx` | tsc | [ ] |
| D2 | P3.1 | Gắn BottomNav/FAB vào layout; theme blue đã có trong globals.css | `Shell.tsx` / layout | tsc + build | [ ] |
| D3 | P3.3 | Kanban realtime 5 cột (swipe status) — verify `dashboardAll` sẵn có hoặc build mới | `app/(app)/sc/page.tsx` | tsc | [ ] |
| D4 | P3.4 | Placeholder ảnh hiện trường gắn `sc.hinh_anh[]` (UI form SC) | `app/(app)/sc/[id]/page.tsx` | tsc | [ ] |

---

## GIAI ĐOẠN E — TEST & DOCS (P6)

| Mã | Thuộc | Mô tả | File | Chứng minh | Trạng thái |
|----|-------|-------|------|------------|------------|
| E1 | P6.1 | `npm run build` (web) pass | - | build success | [ ] |
| E2 | P6.2 | `npm run test:contract` pass (nếu đổi contract ở B11) | - | pass | [ ] |
| E3 | P6.3 | Playwright E2E mobile 375px: login từng ws + FAB + chuyển ws + view-only giamdoc; **quay video** UIUX | `apps/web/e2e/workspace.spec.ts`, video.webm | E2E pass + video | [ ] |
| E4 | P6.4 | Cập nhật `docs/Architect.md` (workspace + theme) | `docs/Architect.md` | - | [ ] |
| E5 | P6.5 | Chốt `CHANGELOG.md` v4.3.0 (thực tế, không đệt-optimistic) | `plan_4workspace/CHANGELOG.md` + root `changelog_v4.3.0.md` | - | [ ] |

---

## THỨ TỰ ƯU TIÊN THỰC THI (mỗi phiên làm tiếp theo)
1. **A8** (build web) — chốt P1/P5 không lỗi runtime.
2. **B1→B12** — backend TDD (lõi truy vết + sổ quỹ). Đây là phần rủi ro nhất (SQL/transaction).
3. **C1→C5** — dashboards (có data từ B).
4. **D1→D4** — mobile Xưởng.
5. **E1→E5** — verify + video + docs.

## RỦI RO ĐANG THEO DÕI (từ ai_config.yaml)
- R1 IDOR workspace — filter perms server+client (đã làm A1/A5, cần test E3).
- R2 Giám đốc vô tình sửa — editMode default false + modal (đã làm A7, cần test E3).
- R3 ExcelTable treo — pagination client (A4) đủ với dữ liệu vừa; nếu >1000 row mới cần virtualization.
- R5 Mobile chưa test — E3 Playwright 375px.
- R6 Pha trộn theme — `data-ws` isolate vars; badge giữ nguyên (A6).

## LỖI ĐÃ BIẾT / QUYẾT ĐỊNH LỆCH THIẾT KẾ
- **ChartCard dùng SVG thay Recharts**: để tránh rủi ro dependency/build, dùng SVG tự vẽ (pie/bar). Chức năng tương đương, ít dep. Ghi chú trong changelog.
- **editMode đặt ở WorkspaceContext thay SessionContext**: functionally tương đương, tránh xung đột context ordering. Ghi chú.
- **Audit log khi bật editMode**: plan nói ghi log_audit, nhưng PA1.backend_change=none → chưa thêm RPC write-audit; chỉ `console.info` dev. Sẽ bổ sung RPC `auditWrite` (ADD) nếu cần truy vet thật.
