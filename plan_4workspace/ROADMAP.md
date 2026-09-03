# ROADMAP — Kế hoạch thực hiện chi tiết (v4.3 Workspace)

> Thứ tự đã chốt: **UI workspace trước (P1–P3)** → **backend gap (P4)** → **view-only (P5)** → **test/docs (P6)**.
> Mỗi bước tuân thủ `TESTING.md` (dev-workflow 5 bước + TDD cho logic cốt lõi).

---

## P1 — WORKSPACE INFRASTRUCTURE (chỉ UI, không đổi backend)

**Mục tiêu:** có khung 4 workspace, theme-per-workspace, sub-nav chuẩn, ExcelTable.

### P1.1 `components/WorkspaceContext.tsx` (mới)
- State: `ws: 'xuong'|'kho'|'ketoan'|'quantri'`, `editMode: boolean`.
- Đọc `useSession().perms` → lọc workspace hiển thị (giamdoc → 4; tho → xuong; ...).
- Persist `ws` vào `localStorage`; sync với `?ws=` trên URL (không đổi route).

### P1.2 `components/WorkspaceSelector.tsx` (mới) — gắn `Topbar`
- Dropdown 4 workspace, icon + label, filter by perms. Giamdoc thấy tất cả.

### P1.3 `components/SubNav.tsx` (mới) — thay `KeToanNav` / `KhoNav`
- Props: `items: {href, label, perm?}[]`. Mobile: horizontal scroll. Check quyền từng item.

### P1.4 `components/ui/ExcelTable.tsx` (mới)
- Props: `columns`, `rpc` (load), `filter`, `sort`, `pageSize`, `realtimeTables?`.
- Tính năng: sticky header, zebra, hover, sort cột, filter inline, **pagination server-side**
  (dùng `Pager` có sẵn), realtime qua `useRealtimeMulti`.
- >100 rows → virtualization (windowing) để tránh treo (R3).

### P1.5 `components/Sidebar.tsx` (refactor)
- Nhóm menu theo workspace từ `navItems` (đã build theo perms ở `layout.tsx`).
- Ẩn hoàn toàn menu workspace khác.

### P1.6 `globals.css` + `app/(app)/layout.tsx`
- Theme per workspace:
  ```css
  [data-ws="xuong"]  { --c-primary:#2563EB; --c-bg:#FFFFFF; --c-text:#1F2937; }
  [data-ws="kho"],
  [data-ws="ketoan"] { --c-primary:#0E5A37; --c-bg:#FFFFFF; --c-text:#1F2937; }
  /* badge danger/warn/ok GIỮ NGUYÊN, không bị override */
  ```
- `layout.tsx` set `data-ws={ws}` trên `<body>` từ session/URL.

**Gate P1:** `npx tsc --noEmit` pass; build được; chuyển workspace không lộ menu role khác.

---

## P2 — CLONE CARDOCTOR (KHO & KẾ TOÁN) — trắng/đen

### P2.1 Kho dashboard
- `ExcelTable` tồn kho: highlight đỏ nếu `ton < tonMin`; cột "Thiếu" 🔴.
- `ChartCard` (Recharts): biểu đồ cảnh báo thiếu theo nhóm vật tư.

### P2.2 Kế toán dashboard
- `ChartCard`: CĐKT (pie), chi phí 621/622/627/641/642 (bar).
- `ExcelTable` chứng từ gần nhất + link vào chi tiết.

### P2.3 Tab ngang (SubNav)
- Kho: `Tồn kho | Nhập | Xuất | Đề nghị mua | Báo giá | Thanh lý`
- Kế toán: `Dashboard | Nhập vật | Công nợ | Báo cáo | Khóa kỳ` (giữ route `ke-toan/*`)

### P2.4 In A4 (`/in/*`) — giữ nguyên, chỉ đổi header màu theo workspace.

---

## P3 — CLONE VC GARAGE MOBILE (XƯỞNG) — blue/trắng

### P3.1 Theme
- Blue `#2563EB`, nền trắng, nút action ≥44px.

### P3.2 Mobile navigation
- Bottom nav: 🏠 Home | 🔧 SC | 📋 Đề xuất | 📦 Kho | 💬 Chat.
- **FAB** nổi: "+ Tạo lệnh" (mở modal tiếp nhận nhanh).

### P3.3 Kanban realtime
- 5 cột (`dashboardAll` đã có): swipe cập nhật trạng thái SC.

### P3.4 Ảnh hiện trường (chỉ UI ở P3, lưu sau ở P4)
- Placeholder upload gắn `sc.hinh_anh[]` (tái dùng upload của `chat.ts`).

---

## P4 — BACKEND GAP + SỔ QUỸ / PHIẾU THU (TDD trước khi UI)

> Theo dev-workflow B3: viết test (RED) trước cho mọi logic cốt lõi.

### P4.1 Kho (`packages/core/src/kho.ts`)
- `tonKhoReport(from,to)` — báo cáo XNT tổng hợp.
- `vatTuHistory(id)` — lịch sử nhập/xuất theo vật tư.
- `search.ts` mở rộng index `vattu`.
- `phChuyenKhoCreate` — chuyển kho nội bộ (không đổi tiền).

### P4.2 Xưởng (`sc.ts`, `scoring.ts`)
- Bảng `sc_phuong_an` + `scProposalSave/List` — proposal A/B/C.
- `sc.hinh_anh TEXT[]` — ảnh hiện trường.
- Bảng `xe_danh_gia` + `xeScoreSave/Get` — gắn engine `scoring.ts` (A–E) vào DB.
- Bảng `bao_duong_lich` + `nhacHanCreate` — cảnh báo bảo dưỡng định kỳ.

### P4.3 Kế toán — SỔ QUỸ + PHIẾU THU NỘI BỘ (`ledger.ts`)
- Bảng `so_quy` (111 tiền mặt / 112 TGNH).
- `phieuThuCreate` — thu nội bộ (hoàn ứng, thu hồi VT, thu khác):
  Nợ 111/112, Có 331/334/421. **KHÔNG** doanh thu/AR khách.
- `ledgerReport` mở rộng thêm sổ quỹ.
- `packages/db/schema.sql` ADD các bảng mới + seed nếu cần.

**Gate P4:** contract test (`npm run test:contract`) pass; unit test logic mới pass.

---

## P5 — GIÁM ĐỐC VIEW-ONLY (PA1)

### P5.1 `SessionContext` thêm `editMode`
- Mặc định **false** với `giamdoc`.

### P5.2 `components/ReadOnlyGuard.tsx` (mới)
- Bao form/button → `disabled` + ẩn khi `!editMode`.

### P5.3 `Topbar` — nút "✏️ Bật chỉnh sửa"
- Modal xác nhận ("Bạn sắp chuyển sang chế độ duyệt") → `editMode=true`.
- Ghi `log_audit` khi bật (truy vet).

### P5.4 Backend
- **KHÔNG đổi** `can()`; UI không gửi POST khi view-only.

---

## P6 — TEST & DOCS

### P6.1 Chạy cổng
- `npx tsc --noEmit` + `npm run build` (phải pass).
- `npm run test:contract` + conformance (nếu ảnh hưởng contract).

### P6.2 E2E mobile
- Playwright viewport 375px: login từng workspace + FAB tạo lệnh (R5).

### P6.3 Docs
- Cập nhật `docs/Architect.md` (workspace + theme) + `CHANGELOG.md` (v4.3.0).
- Cập nhật `plan_4workspace/CHANGELOG.md` này.

---

## Ma trận phụ thuộc

```
P1 ──► P2 (Kho&KT UI) ──┐
P1 ──► P3 (Xưởng UI)    ─┤
P4 (backend) ────────────┼──► P5 (view-only) ──► P6 (test/docs)
P1 ──► P5 (cần SessionContext)
```

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** Thực thi code P1–P6 (mới ở mức kế hoạch).
> - **Rủi ro ở đâu?** Xem `ai_config.yaml` mục `risks`. Tránh đổi backend contract.
> - **Đã chạy kiểm thử chưa?** Chưa (trước thực thi).
> - **Đề xuất tiếp theo?** Theo `TASKS.md` tick từng hạng mục; load `ai_config.yaml` làm ràng buộc.
