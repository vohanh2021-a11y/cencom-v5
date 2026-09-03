# TASKS — CẬP NHẬT PLAN ĐIỀU CHỈNH 18.08 (v2)

> Quy tắc: mỗi batch B1–B5 là 1 file nhỏ, làm xong mới qua batch sau.
> Mỗi batch chỉ sửa đúng các file được liệt kê, không lan sang file khác.

## B1 — RBAC & ROLE (file: 00, 02, 04§C)
- Đổi `khoa` → `khovattu` mọi nơi.
- Thêm role `pttb`, `laixe` (thực).
- File: `00-README.md`, `02-traceability.md`, `04-compliance-p2-p3.md` (mục C).

## B2 — COMPLIANCE & KẾ TOÁN (file: 04§A, 03)
- Thêm `cp_ve_phuphi` trên `phieu_chi` (nhánh 4).
- Chi phí không sổ sách (vé/gửi/tiền mặt) → gộp 642/241 (`co_vat=false, loai_chung_tu='khac'`).
- Tam ứng tiền mặt → HOÃN giai đoạn 2 (dùng `ghi_no` drop-list hiện tại).
- File: `04-compliance-p2-p3.md` (mục A), `03-audit-8-mau.md` (phần xuất file).

## B3 — FLOWCHART (file: 05)
- Thay sơ đồ cũ bằng: 8 bước progress bar + nested branch tree (4.1/4.2/4.3) + pipeline mini-graph.
- File: `05-flowchart.md`.

## B4 — APP PROGRAM / UI (file: 06)
- UI master = **Expandable Card List** (Shopify/Linear/Notion).
- Card detail = pipeline mini-graph + 8 bước progress + log.
- Kanban giữ lại dạng toggle nhẹ (4 cột).
- Timeline ngắn gọn + Alert icon P2.
- Đổi `khoa` → `khovattu` trong role dashboards.
- File: `06-app-program.md`.

## B5 — ACTION PLAN & AUDIT (file: 07 + audit mới)
- Thêm task UI (card list, pipeline, kanban toggle, export xlsx/PDF).
- Thêm `cp_ve_phuphi`, export format vào plan.
- Tạo `08-AUDIT-TONG-THE.md` tổng kết gap trước build.
- File: `07-ACTION-PLAN.md`, `08-AUDIT-TONG-THE.md` (mới).
