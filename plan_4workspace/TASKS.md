# TASKS — Danh sách công việc (tracking)

> **QUAN TRỌNG:** Bản đồ thực thi hạt giống chi tiết nằm ở `TASKS_DETAILED.md`
> (chia từng P thành task 5–15 phút, có file/input/output/cách chứng minh/trạng thái).
> File này chỉ là bản tóm tắt tick nhanh, đọc `TASKS_DETAILED.md` để biết "làm bước nào tiếp".

## Tiến độ tổng thể (cập nhật 2026-08-17)

### Giai đoạn A — Workspace infra (P1) + View-only (P5) — CODE XONG, CHỜ BUILD
- [x] A1 WorkspaceContext.tsx
- [x] A2 WorkspaceSelector.tsx
- [x] A3 SubNav.tsx
- [x] A4 ExcelTable.tsx
- [x] A5 Sidebar refactor (nhóm theo ws)
- [x] A6 globals.css theme `[data-ws]` + WorkspaceTheme + Shell/Topbar wiring
- [x] A7 View-only: editMode + ReadOnlyGuard + Topbar toggle + modal
- [x] A8 `npm run build` (web) — PASS (2026-08-17, toàn bộ route ke-toan/* compile xanh)

### Giai đoạn B — Backend Gap + Sổ quỹ (P4, TDD)
- [ ] B1 schema mới vào CẢ schema.sql (PGlite)
- [ ] B2 tonKhoReport (kho.ts) + test
- [ ] B3 vatTuHistory (kho.ts) + test
- [ ] B4 phChuyenKhoCreate (kho.ts) + test
- [ ] B5 phieuThuCreate (ledger.ts, so_quy) + mở rộng ledgerReport
- [ ] B6 ledgerReport mở rộng sổ quỹ
- [ ] B7 scProposalSave/List (sc.ts) + test
- [ ] B8 xeScoreSave/Get (xe.ts) + test
- [ ] B9 baoDuongTao/List (baoduong.ts) + test
- [ ] B10 search.ts index vattu
- [ ] B11 contract Zod + RPC_SCHEMAS + rpc-dispatch + perm MATRIX
- [ ] B12 vitest + contract test pass

### Giai đoạn C — Clone CarDoctor (P2)
- [ ] C1 ChartCard (SVG)
- [ ] C2 Kho dashboard (ExcelTable + ChartCard + SubNav)
- [ ] C3 Kế toán dashboard (ChartCard + ExcelTable)
- [ ] C4 Thay KeToanNav bằng SubNav
- [ ] C5 In A4 header theo workspace

### Giai đoạn D — Clone VC Garage Mobile (P3)
- [ ] D1 BottomNav + FAB (ws=xuong)
- [ ] D2 Gắn layout
- [ ] D3 Kanban realtime
- [ ] D4 Ảnh hiện trường sc.hinh_anh[]

### Giai đoạn E — Test & Docs (P6)
- [ ] E1 `npm run build` pass
- [ ] E2 `npm run test:contract` pass
- [ ] E3 Playwright E2E 375px + VIDEO UIUX
- [ ] E4 docs/Architect.md
- [ ] E5 CHANGELOG v4.3.0 (thực tế)

## Rủi ro đang theo dõi
- [~] R1 IDOR workspace — đã filter server+client (A1/A5), cần test E3
- [~] R2 Giám đốc vô tình sửa — editMode default false + modal (A7), cần test E3
- [x] R3 ExcelTable treo — pagination client (A4)
- [ ] R5 Mobile chưa test — E3
- [x] R6 Pha trộn theme — data-ws isolate, badge giữ nguyên (A6)

## Quyết định lệch thiết kế (ghi chú)
- ChartCard dùng SVG thay Recharts (tránh dep-risk).
- editMode đặt ở WorkspaceContext thay SessionContext (tránh context ordering).
- Audit log editMode: chỉ console.info (PA1.backend_change=none), chưa thêm RPC write-audit.

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** A8 (build), toàn bộ B/C/D/E chưa làm.
> - **Rủi ro ở đâu?** B (SQL/transaction), E3 (mobile/video).
> - **Đã chạy kiểm thử chưa?** Web tsc = 0 lỗi (A1–A7). Chưa build, chưa vitest mới, chưa E2E.
> - **Đề xuất tiếp theo?** Làm A8 (build) → B1–B12 (backend TDD).
