# Plan_02 — Schema Sổ cái & chứng từ  ·  Chức năng: Sổ cái  ·  GĐ1

**Đầu vào:** `read_01` §4 (ràng buộc cân bằng).
**Đầu ra:** bảng `chung_tu`, `ledger`, `ky_ke_toan`, `ke_toan_setting`, `ton_lot`, `vat_invoice` (khung), `cong_no`.

## Các bước (TDD)
1. Thêm DDL vào `accounting.sql` + `schema.sql`:
   - `chung_tu(id, tenant_id, so_ct, ngay, loai_ct, nguoi, ref_type, ref_id, note, deleted_at)`.
   - `ledger(id, tenant_id, ct_id FK chung_tu, ngay, tai_khoan, du_no NUMERIC(14,2), du_co NUMERIC(14,2), ref_type, ref_id, deleted_at)` + `CONSTRAINT chk_ledger_side CHECK ((du_no>0 AND du_co=0) OR (du_co>0 AND du_no=0))`.
   - `ky_ke_toan(id, tenant_id, ten_ky, tu_ngay, den_ngay, da_dong BOOL, deleted_at)`.
   - `ke_toan_setting(id, tenant_id, key, value)` unique(tenant_id,key) — seed `cogs_method='binh_quan'`.
   - `ton_lot(id, tenant_id, vattu_id, phieu_nhap_id, so_luong, gia, con_lai, ngay, deleted_at)` (cho FIFO).
   - `vat_invoice(...)` + `cong_no(...)` (khung, GĐ3 dùng).
2. Test: tạo `chung_tu` + 2 `ledger` (1 Nợ, 1 Có) thành công; chèn `ledger` vi phạm `chk_ledger_side` → DB reject.
3. Áp dụng live DB.

**Đối chiếu:** `ledger.ct_id` REFERENCES `chung_tu(id)` → mỗi bút toán thuộc 1 chứng từ. Ràng buộc DB bảo vệ cân bằng ở mức schema.
**Rủi ro:** `NUMERIC(14,2)` vs bảng cũ `REAL` → chỉ bảng mới; convert khi đọc bảng cũ.
