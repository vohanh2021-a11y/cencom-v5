# UIUX_REVIEW — Đối chiếu chuyên nghiệp & Đề xuất nâng cấp

> Mục tiêu: so sánh UI cencomOS hiện tại với chuẩn ngành (CarDoctor GMS, VC Garage, MISA),
> tìm điểm yếu, và đề xuất nâng cấp cụ thể cho v4.3 Workspace.

---

## 1. Đối chiếu với phần mềm tham chiếu

| Tiêu chí | CarDoctor GMS | VC Garage | MISA | CencomOS hiện tại | Chuẩn v4.3 |
|---|---|---|---|---|---|
| Màu nền chính | Trắng | Đỏ/trắng | Trắng | Xanh đen (gradient) | Trắng (Kho/KT/Xưởng) |
| Mật độ dữ liệu | Cao (excel-like) | Thấp (action) | Rất cao | Trung bình (.tbl) | Cao (ExcelTable) |
| Tab ngang | Có | Có | Có | Chỉ Kế toán/Kho | Tất cả ws |
| Sidebar dọc | Có (chức năng con) | Ít (mobile bottom) | Có | Có (phẳng) | Có (nhóm ws) |
| Biểu đồ dashboard | Có | Có (realtime) | Có | Ít | Có (ChartCard) |
| Mobile-first | Trung bình | **Rất tốt** | Kém | Kém | **Tốt** (Xưởng) |
| Phân quyền view | Có | Có | Có | Giamdoc vẫn edit | **PA1 toggle** |
| Keyboard/Command | — | — | Có | Có (CommandPalette) | Giữ nguyên |

---

## 2. Điểm yếu hiện tại của cencomOS UI

### 2.1 Kiến trúc điều hướng
- **W1 — Sidebar phẳng 11–19 mục:** thợ/kế toán/thủ kho nhìn cùng 1 mớ menu → khó tìm, dễ thao tác nhầm (nhất là giám đốc).
- **W2 — Sub-nav không thống nhất:** `KeToanNav` có check quyền, `KhoNav` không → lỗ hổng hiển thị menu (R1).
- **W3 — Thiếu workspace selector:** không có khái niệm "không gian làm việc" → không thể theme riêng.

### 2.2 Đọc số liệu & bảng biểu
- **W4 — Thiếu ExcelTable:** chỉ CSS `.tbl`, không sort/filter/pagination chuẩn → kế toán đối chiếu chứng từ chậm.
- **W5 — Màn hình tối (gradient xanh đen):** đọc bảng kê/chi tiết tài chính lâu gây mỏi mắt (không hợp kế toán/kho).
- **W6 — Thiếu biểu đồ:** dashboard hiện tại ít hình hóa → giám đốc/kế toán khó nắm tổng quan.

### 2.3 Mobile & thao tác nhanh
- **W7 — Không mobile-first:** lập phiếu tiếp nhận trên điện thoại rất khó (form dài, nút nhỏ).
- **W8 — Thiếu FAB / bottom nav:** thợ ngoài xưởng không có đường tắt tạo lệnh.

### 2.4 An toàn thao tác
- **W9 — Giám đốc có quyền edit mặc định:** rủi ro chỉnh sửa nhầm dữ liệu sản xuất (R2).
- **W10 — Thiếu empty state / skeleton:** trang trống hoặc loading không rõ ràng → cảm giác "treo".

---

## 3. Đề xuất nâng cấp (cụ thể cho v4.3)

### 3.1 Cấu trúc (giải W1,W2,W3)
- 4 workspace + `WorkspaceSelector` (P1.2). Sidebar nhóm theo ws, ẩn theo perms (P1.5).
- `SubNav` chuẩn hóa, **check quyền từng item** (sửa W2) (P1.3).

### 3.2 Đọc số liệu (giải W4,W5,W6)
- `ExcelTable` chuẩn MISA: sort click cột, filter inline, pagination server-side, sticky header, căn phải số (P1.4).
- Theme trắng cho Kho/Kế toán/Xưởng (P1.6) — giảm mỏi mắt.
- `ChartCard` (Recharts): CĐKT pie, chi phí bar, cảnh báo tồn kho (P2.1/P2.2).

### 3.3 Mobile (giải W7,W8)
- Bottom nav 5 mục + FAB tạo lệnh (P3.2).
- Form tiếp nhận thu gọn, nút ≥44px, swipe đổi trạng thái Kanban (P3.1/P3.3).

### 3.4 An toàn (giải W9,W10)
- Giám đốc view-only PA1: `editMode` default false + modal xác nhận (P5).
- Thêm `EmptyState`, `Skeleton` nhất quán (đã có component sẵn, áp dụng triệt để).

### 3.5 Nâng cấp tiệm cận (đề xuất thêm, nằm ngoài P1–P6)
- **Keyboard shortcut theo workspace** (vd `N` = tạo mới trong ws hiện tại).
- **Bulk action** trên ExcelTable (chọn nhiều → duyệt/xuất hàng loạt).
- **Saved filters / view** cho kế toán (lưu bộ lọc thường dùng).
- **Density toggle** (comfortable / compact) cho người dùng thích đọc dày.
- **Export PDF chuẩn A4** từ ExcelTable (đã có `/in/*`, mở rộng).

---

## 4. Ma trận ưu tiên đề xuất

| Điểm yếu | Mức độ | Thuộc P | Ưu tiên |
|---|---|---|---|
| W9 Giám đốc edit | Cao | P5 | **P0 (làm sớm)** |
| W1/W2/W3 cấu trúc | Cao | P1 | Cao |
| W4 ExcelTable | Cao | P1 | Cao |
| W5 màn tối | TB | P1.6 | Cao |
| W7/W8 mobile | Cao | P3 | Cao |
| W6 biểu đồ | TB | P2 | TB |
| W10 empty/skeleton | Thấp | P1 | TB |
| 3.5 nâng cấp tiệm cận | TB | — | Sau v4.3 |

---

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** Thực thi các P để giải quyết W1–W10.
> - **Rủi ro ở đâu?** Đổi theme có thể làm rối badge (đã có R6 → giữ badge nguyên).
> - **Đã chạy kiểm thử chưa?** Chưa (kế hoạch). Khi làm P1.6 phải check badge màu đúng.
> - **Đề xuất tiếp theo?** Ưu tiên P0 (view-only) + P1 (cấu trúc + ExcelTable) trước.
