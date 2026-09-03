# Plan_08 — Báo cáo & Xuất Excel  ·  Chức năng: Báo cáo  ·  GĐ4

**Đầu vào:** kỳ kế toán (`ky_ke_toan`), dữ liệu `ledger`.
**Đầu ra:** CĐKT, Báo cáo chi phí (KQHĐKD không doanh thu), sổ 152/331, xuất Excel (`/export/*`).

## Các bước (TDD)
1. Test: `ledgerReport(ky)` trả CĐKT đúng (tài sản = nợ, nguồn vốn = có), tổng bằng nhau.
2. `ledgerReport(api, {ky})`:
   - CĐKT: group `ledger` theo `tai_khoan.loai`, tính số dư (Nợ−Có cho tài sản/chi phí; Có−Nợ cho nợ/nguồn).
   - Báo cáo chi phí: tổng `621,622,627,641,642` trong kỳ.
   - Sổ chi tiết 152 (nhập/xuất/lôt) + 331 (công nợ NCC) + 133 (thuế).
3. Xuất Excel: dùng `report.ts` (đã có ExcelJS) → `buildCdtkWorkbook`, `buildKqhdkWorkbook`, `buildSo152Workbook`, `buildSo331Workbook`. Mô tả bước thực hiện trong file Excel (sheet "Hướng dẫn").
4. `kyClose(api, {ky})`: đánh dấu `da_dong=true` → chặn mọi `ledgerPost` có `ngay` trong kỳ (đã chặn ở Plan_03).

**Đối chiếu:** CĐKT tổng tài sản = tổng nguồn vốn; 152 ≡ `tonKho`; 331 ≡ `cong_no`.
**Rủi ro:** số dư âm do bút toán sai → báo cáo cảnh báo.
