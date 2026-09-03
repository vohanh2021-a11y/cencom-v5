# B5 — ACTION PLAN & AUDIT

## Mục tiêu
Cập nhật kế hoạch hành động + tạo file audit tổng thể trước khi build code.

## Phạm vi file sửa/tạo
1. `07-ACTION-PLAN.md` (sửa)
2. `08-AUDIT-TONG-THE.md` (tạo mới)

## Việc cần làm
- [ ] `07`: thêm Giai đoạn UI (G7) với task: card list, pipeline view, kanban toggle, export xlsx/PDF.
- [ ] `07`: cập nhật G2/G3 để nhắc `cp_ve_phuphi`, gộp 642, hoãn tạm ứng.
- [ ] `07`: đổi `khoa` → `khovattu` trong mọi giai đoạn.
- [ ] `08-AUDIT-TONG-THE.md`: tổng hợp gap còn thiếu trước build:
  - Role `khovattu`/`pttb`/`laixe` chưa có thực trong `perm.ts`/`auth.ts`.
  - `phieuChiCreate` chưa check `vat_invoice`.
  - `cp_ve_phuphi` chưa có cột schema.
  - `sc.ket_luan`/`sc.nhanh` chưa có.
  - Export xlsx 9 tab / PDF A5-A4 chưa có handler.
  - UI Kanban chưa chuyển Expandable Card List.

## Tiêu chí xong
- `07` có G7 UI + nhắc `cp_ve_phuphi`.
- `08-AUDIT-TONG-THE.md` tồn tại, liệt kê gap rõ.

## KHÔNG làm
- Không sửa code. Không đụng 00/02/03/04/05/06.
