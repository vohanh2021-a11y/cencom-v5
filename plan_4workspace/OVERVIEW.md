# OVERVIEW — Tình huống & Lý do thay đổi (v4.3 Workspace)

## 1. Tình huống hiện tại (v4.0–v4.2)

Sau khảo sát `packages/core` (27 module), `apps/web` (19 route groups) và so sánh với
CarDoctor GMS / VC Garage, hiện trạng như sau:

### 1.1 Backend (rất chín, nhưng thiếu tầng báo cáo/truy vết)
- **Kho & Mua**: đủ (vatTu, phNhap, phXuat, dm, autoGenCuHong, cảnh báo tồn thấp).
- **Sửa chữa**: state machine SC đầy đủ, 8 bước hồ sơ, Kanban, ETA.
- **Kế toán**: sổ cái kép, VAT, công nợ NCC, khóa kỳ, CĐKT.
- **Thiếu**: báo cáo XNT tổng hợp, lịch sử nhập/xuất theo vật tư, phương án sửa chữa
  (proposal), ảnh hiện trường gắn SC, `scoring` engine chưa gắn DB, cảnh báo bảo dưỡng
  định kỳ, sổ quỹ / phiếu thu nội bộ.

### 1.2 UI (đang là "flat", 1 theme)
- Sidebar trái gradient xanh lá, liệt kê 11–19 mục phẳng (không phân nhóm công việc).
- Chỉ có `KeToanNav` (có check quyền) và `KhoNav` (không check quyền) làm sub-nav rời rạc.
- **Chưa có** ExcelTable (chỉ CSS `.tbl`), chưa có workspace selector, chưa mobile-first.
- Màu brand: xanh lá `#0E5A37` + cam `#F28C1D` + kem `#FBF6EE` cho mọi màn hình.
- Giám đốc (`giamdoc`) hiện **vẫn có quyền duyệt (edit)** ở sc/mua/asset → chưa đúng
  yêu cầu "vào được tất cả nhưng không chỉnh sửa".

## 2. Bài toán người dùng & lý do cần đổi

| # | Bài toán | Tại sao phải đổi |
|---|---|---|
| 1 | **1 giao diện cho mọi vai trò** gây rối, thợ/quản lý/kế toán/thủ kho nhìn cùng 1 mớ menu | Mỗi nhóm công việc cần tập trung vào data/action riêng; UI phẳng làm giảm tốc độ và dễ thao tác nhầm |
| 2 | **Kế toán / thủ kho** cần màn hình **trắng, chữ đen, excel-like, có biểu đồ** (như MISA/CarDoctor) để đọc số liệu lâu không mỏi | Màn hình tối/màu đậm gây mỏi mắt khi đối chiếu bảng kê, chứng từ |
| 3 | **Thợ / quản lý** cần **lập phiếu trên điện thoại**, nút to, realtime (như VC Garage) | Xưởng thường xa máy tính; điện thoại là thiết bị chính để tiếp nhận & cập nhật tiến độ |
| 4 | **Giám đốc** muốn **xem toàn bộ** nhưng **không sửa** để tránh sai sót vô tình | Quyền duyệt mặc định = rủi ro chỉnh sửa nhầm dữ liệu sản xuất |
| 5 | Thiếu **báo cáo XNT, lịch sử vật tư, proposal, scoring, bảo dưỡng** → kế toán/xưởng vẫn làm thủ công | Lỗ hổng truy vết, khó đối chiếu kho–kế toán, khó đánh giá xe |

## 3. Mục tiêu v4.3

> Trên **1 core phần mềm duy nhất** (không đổi backend contract `POST /api/rpc`,
> không đổi schema nghiệp vụ cốt lõi, không đổi RBAC 3 lớp), xây dựng **4 workspace
> giao diện độc lập** phục vụ từng nhóm công việc, clone phong cách UI phù hợp, bổ sung
> các tính năng truy vết/thuận tiện còn thiếu, và đặt giám đốc ở chế độ xem an toàn.

### 3.1 Phân vùng workspace (đã chốt)

| Workspace | Phong cách | Theme | Routes gộp | Đối tượng |
|---|---|---|---|---|
| XƯỞNG | VC Garage mobile-first | blue `#2563EB`, nền trắng | dashboard, sc, de-xuat, nhac-han, asset | thợ, xưởng, quản lý |
| KHO & MUA | CarDoctor / MISA | brand `#0E5A37`, nền trắng, chữ đen | kho, thanhly, baogia | thủ kho, kế toán mua |
| KẾ TOÁN | CarDoctor + biểu đồ | brand `#0E5A37`, nền trắng, chữ đen | ke-toan/* | kế toán, giám đốc |
| QUẢN TRỊ | Hiện tại (Calm) | gradient xanh đen | users, perm, audit, preview, xe, khach-hang | admin |
| GIÁM ĐỐC | Xem 4 ws | theo ws | tất cả (PA1 toggle) | giamdoc |

### 3.2 Nguyên tắc bất di bất dịch
- KHÔNG đổi `packages/core` contract / `packages/db` schema nghiệp vụ cũ (chỉ ADD bảng mới).
- KHÔNG đổi `POST /api/rpc {fn,args}` (client cũ vẫn chạy).
- KHÔNG đổi RBAC `can()` — chỉ bổ sung view-only mode ở UI + session.
- Mọi input validate + sanitize ở backend; phân quyền trong hàm xử lý.

## 4. Tham chiếu đối thủ (để clone)

- **CarDoctor GMS** (2026): màn trắng chữ đen, tab ngang + sidebar dọc + excel-like,
  có biểu đồ đánh giá. Rất hợp kế toán/kho (data-dense).
- **VC Garage**: đỏ trắng, mobile-first, tạo phiếu trên điện thoại, dashboard từ xa realtime.
  (CencomOS dùng blue thay đỏ theo quyết định #4 để không xung đột brand cam).
- **MISA**: tham chiếu bảng kê/chi tiết tài chính (trắng, font rõ, số căn phải).

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** Thực thi P1–P6 (chưa có code).
> - **Rủi ro ở đâu?** Giữ nguyên backend contract là ưu tiên — nếu lỡ đổi schema sẽ phá client cũ.
> - **Đã chạy kiểm thử chưa?** Chưa (giai đoạn kế hoạch).
> - **Đề xuất tiếp theo?** Đọc `ROADMAP.md` để biết từng bước, `ai_config.yaml` để ràng buộc AI.

---

## 5. TRẠNG THÁI THỰC THI (cập nhật 2026-08-17)

> Bản đồ chi tiết từng bước: xem `TASKS_DETAILED.md`. Tick nhanh: `TASKS.md`.

### 5.1 Đã làm (code, chưa build đầy đủ)
- **Giai đoạn A — Workspace infra (P1):** `WorkspaceContext`, `WorkspaceSelector`, `SubNav`,
  `ExcelTable`, Sidebar nhóm theo ws, `globals.css` theme `[data-ws]` (xuong blue / kho+ketoan
  green / quantri giữ nguyên), `WorkspaceTheme` set `data-ws` trên body, wiring vào `Shell`/`Topbar`.
- **Giai đoạn A7 — View-only (P5/PA1):** `editMode` (default false với giamdoc) trong
  `WorkspaceContext`, `ReadOnlyGuard` vô hiệu form, nút "Bật chỉnh sửa" + modal xác nhận trên Topbar.
- **Schema (accounting.sql):** đã ADD `so_quy`, `sc_phuong_an`, `xe_danh_gia`, `bao_duong_lich`,
  `sc.hinh_anh TEXT[]` (idempotent). **CHƯA** thêm vào `schema.sql` (dùng test PGlite) → làm ở B1.

### 5.2 Bằng chứng đã có
- `cd apps/web && npx tsc --noEmit` → **0 lỗi** (A1–A7 compile sạch).
- Chưa chạy: `npm run build` (web), `vitest` (core mới), E2E/video.

### 5.3 Thứ tự thực thi tiếp theo (không lạc đề)
1. **A8** — `npm run build` (web) chốt P1/P5 không lỗi runtime.
2. **B1→B12** — Backend gap TDD (tonKhoReport, vatTuHistory, phChuyenKhoCreate, phieuThuCreate,
   scProposal, xeScore, baoDuong, search index) + contract + test.
3. **C1→C5** — Dashboards Kho/Kế toán (ChartCard SVG, ExcelTable, SubNav).
4. **D1→D4** — Mobile Xưởng (BottomNav + FAB, Kanban, ảnh hiện trường).
5. **E1→E5** — Build/contract/E2E video/docs/changelog.

### 5.4 Quyết định lệch thiết kế (đã ghi nhận)
- `ChartCard` dùng **SVG tự vẽ** (pie/bar) thay Recharts → tránh rủi ro dependency/build.
- `editMode` đặt ở `WorkspaceContext` thay `SessionContext` → tránh context ordering conflict.
- Audit log bật editMode: chỉ `console.info` (vì PA1.backend_change=none), chưa thêm RPC write-audit.

### 5.5 Rủi ro còn mở
- R1 (IDOR) & R2 (giám đốc sửa nhầm): code xong, cần test E3 (Playwright 375px).
- R5 (mobile): chưa test.
- B (SQL/transaction backend): chưa làm, là phần rủi ro nhất.
