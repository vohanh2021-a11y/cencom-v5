# Plan_04 — Tích hợp Kho ↔ Kế toán  ·  Chức năng: Kho  ·  GĐ2

**Đầu vào:** `kho.phNhapCreate`, `kho.phXuatCreate`, `kho.autoXuatSC` (đã có).
**Đầu ra:** mỗi move kho tự sinh `chung_tu` + bút toán qua `ledgerPost`, trong cùng transaction.

## Các bước (TDD)
1. Test: gọi `phNhapCreate` (NCC, có HĐ) → assert có `ledger` Nợ 152/133, Có 331; `tonKho` khớp số dư 152.
2. Test: `phXuatCreate` (cho SC) → assert `ledger` Nợ 154 / Có 152; COGS theo `cogs_method`.
3. Sửa `kho.ts`:
   - Import `ledger` từ `../ledger.js`.
   - Trong `phNhapCreate` tx: sau cập nhật tồn, gọi `await ledger.postInner(tx, {loai_ct:'phieu_nhap', ref_id: phId, entries:[{tk:'152',du_no:tongHang},{tk:'133',du_no:thue},{tk:'331',du_co:tongHang+thue}]})`.
   - Trong `phXuatCreate`/`autoXuatSC`: `postInner(tx,{loai_ct:'phieu_xuat', ref_id, entries:[{tk:'154',du_no:giaVon},{tk:'152',du_co:giaVon}]})`.
   - `giaVon` = theo `cogs_method`: `binh_quan`→`vattu.gia`; `fifo`→tính từ `ton_lot`.
4. COGS method: thêm helper `tinhGiaVon(tx, vattuId, sl)` đọc `ke_toan_setting.cogs_method`.
5. Đối chiếu tự động: báo cáo `reconcile_152` (số dư 152 vs `tonKho`).

**Đối chiếu:** Kế toán ↔ Kho "theo sát" (yêu cầu người dùng). Số dư 152 (ledger) ≡ `kho.tonKho`.
**Rủi ro:** `ledgerPost` dùng `nextId` riêng → cần truyền `tx` xuống (thêm `postInner(tx, arg)` không checkLock, dùng trực tiếp tx).
