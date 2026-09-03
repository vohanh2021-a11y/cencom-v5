# Plan_05 — Tích hợp SC/Asset ↔ Kế toán  ·  Chức năng: SC  ·  GĐ2

**Đầu vào:** `asset.quyetToan`, `asset.khauHao` (định kỳ), `sc.recalc`.
**Đầu ra:** quyết toán SC & khấu hao tự sinh bút toán.

## Các bước (TDD)
1. Test: `quyetToan(scId)` → assert `ledger` Nợ 642 (thường) hoặc 241 (nâng cấp) / Có 154; tổng Nợ 154 của SC = `lich_sua.tong`.
2. Test: `khauHao` định kỳ → assert `ledger` Nợ 627 / Có 214.
3. Sửa `asset.ts`:
   - `quyetToan`: trong tx, sau ghi `lich_sua`, gọi `ledger.postInner(tx,{loai_ct:'quyet_toan', ref_id:scId, entries:[{tk: loaiNangCap?'241':'642', du_no: sc.tong},{tk:'154', du_co: sc.tong}]})`.
   - Phân biệt nâng cấp: đọc cờ trên SC (VD `sc.loai='nang_cap'` hoặc từ `ke_hoach_sc`) — nếu chưa có cờ, mặc định 642 (sửa chữa thường).
   - `khauHao(xe)`: sinh `chung_tu` Nợ 627 / Có 214 (chạy qua `ledgerPost` hoặc `postInner`).
4. Đối chiếu: `lich_sua.tong` (chi phí quyết toán) ≡ tổng Nợ 154 của SC.

**Đối chiếu:** SC ↔ Kế toán: chi phí thực tế (từ `recalc`) phải khớp bút toán 154.
**Rủi ro:** quyết toán 2 lần → `lich_sua` đã chặn trùng; bút toán cũng cần chặn (kiểm tra chưa có `ledger` ref_id trước khi post).
