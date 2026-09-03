# CHANGELOG — cencomOS Gara

Định dạng theo [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Ghi chú: phiên bản package.json root hiện tại là `4.0.0`; chuỗi logic nghiệp vụ
(kế toán cost-side) đang ở `4.2.x`. Đợt nâng cấp này đánh số **v4.3.0**.

---

## [4.3.0] — 2026-08-17 — UI Workspace & Truy xuất nội bộ  **(ĐANG THỰC THI)**

> **Trạng thái: Giai đoạn A (Workspace infra + View-only) ĐÃ CODE, chờ build. B/C/D/E CHƯA LÀM.**
> Bản đồ chi tiết: `TASKS_DETAILED.md`. Tick: `TASKS.md`. Ưu tiên thực thi: A8 → B1–B12 → C → D → E.

### 🎯 Tóm tắt
Tách giao diện thành **4 workspace độc lập** (Xưởng / Kho & Mua / Kế toán / Quản trị)
trên 1 core phần mềm, clone phong cách UI từ CarDoctor GMS (kho/kế toán — trắng/đen,
excel-like, biểu đồ) và VC Garage (xưởng — mobile-first, blue/trắng), bổ sung cơ chế
**Giám đốc view-only (PA1)** và khối **Sổ chi thu nội bộ**. Đồng thời lấp các lỗ hổng
truy vết: báo cáo XNT, lịch sử vật tư, phương án sửa chữa, scoring gắn DB, cảnh báo bảo dưỡng.

### ✅ ĐÃ CODE (Giai đoạn A — chưa build đầy đủ)
- **Workspace Architecture**
  - `WorkspaceContext` + `WorkspaceSelector` (topbar) — chuyển không gian làm việc, persist localStorage + URL `?ws=`, filter perms.
  - `SubNav` chuẩn hóa thay `KeToanNav`/`KhoNav` (check quyền từng item).
  - `ExcelTable` (sort/filter/pagination client-side + realtime reload tùy chọn).
  - `globals.css` theme per-workspace qua `[data-ws]` (Xưởng blue `#2563EB`, Kho/KT brand `#0E5A37`, nền trắng, chữ đen; badge status **giữ nguyên**).
  - Sidebar nhóm theo workspace, chỉ hiện ws hiện tại (R1: ẩn cross-ws cả client; server vẫn `can()`).
- **Giám đốc view-only (PA1)**
  - `editMode` trong `WorkspaceContext` (default false với `giamdoc`) + `ReadOnlyGuard` vô hiệu form.
  - Nút "Bật chỉnh sửa" + modal xác nhận trên Topbar.
  - *Lệch thiết kế:* editMode đặt ở WorkspaceContext (không phải SessionContext) để tránh context ordering. Audit log tạm dùng `console.info` (PA1.backend_change=none).
- **Schema (accounting.sql):** ADD `so_quy`, `sc_phuong_an`, `xe_danh_gia`, `bao_duong_lich`, `sc.hinh_anh TEXT[]` (idempotent). *CHƯA thêm vào `schema.sql` test → làm ở B1.*

### 🚧 CHƯA LÀM (B/C/D/E)
- `ChartCard` (dùng **SVG tự vẽ** thay Recharts — quyết định lệch thiết kế để tránh dep-risk).
- Backend: `tonKhoReport`, `vatTuHistory`, `phChuyenKhoCreate`, `phieuThuCreate` (so_quy), `scProposalSave/List`, `xeScoreSave/Get`, `baoDuongTao/List`, `search` index vattu.
- Dashboards Kho/Kế toán, Mobile Xưởng (BottomNav+FAB), Kanban, ảnh hiện trường.
- E2E Playwright 375px + video, build, contract test, docs.

### 🔒 Security
- **R1 (IDOR):** workspace/sidebar filter `perms` cả server (`layout.tsx`) và client (`WorkspaceContext`/`Sidebar`); backend vẫn `can()`.
- **R2:** giám đốc mặc định không sửa (PA1) → giảm rủi ro chỉnh sửa nhầm.
- Giữ nguyên RBAC 3 lớp, không đổi `can()`; không đổi contract RPC cũ (chỉ ADD); không đổi schema cũ (chỉ ADD bảng).

### 🧪 Testing (đã có)
- `cd apps/web && npx tsc --noEmit` → **0 lỗi** (A1–A7 compile sạch).
- Chưa chạy: `npm run build`, `vitest` core mới, E2E/video.

### 📌 Không đổi (invariants)
- Contract RPC `POST /api/rpc {fn,args}` không đổi.
- Schema nghiệp vụ cũ không đổi (chỉ ADD bảng).
- RBAC `can()` không đổi.

---

## [4.2.x] — Kế toán cost-side (nền tảng của 4.3)
- Sổ cái kép, VAT, công nợ NCC, khóa kỳ, CĐKT, đối chiếu kho–kế toán.
- Quyết toán SC, khấu hao GTTV, báo cáo tài sản.

## [4.0.0] — Cloud rewrite (Supabase)
- Next.js + TS + Tailwind + PostgreSQL/Realtime/Storage.
- Port nguyên logic v3.6, giữ 100% nghiệp vụ.

---

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** Thực thi code P1–P6 (mới ở mức kế hoạch tài liệu).
> - **Rủi ro ở đâu?** Xem `ai_config.yaml` (risks) và `UIUX_REVIEW.md` (W1–W10).
> - **Đã chạy kiểm thử chưa?** Chưa (chỉ viết kế hoạch). Khi thực thi: `tsc`+`build`+E2E.
> - **Đề xuất tiếp theo?** Bắt đầu P1.1 theo `ROADMAP.md` + ràng buộc `ai_config.yaml`.
