# Plan_07 — VAT đầu vào  ·  Chức năng: Thuế  ·  GĐ3

**Đầu vào:** HĐĐT NCC (`bao_gia_ncc` / nhập kho).
**Đầu ra:** `vat_invoice` + bút toán Nợ 133 (thuế ĐƯỢC khấu trừ).

## Các bước (TDD)
1. Test: `vatInvoiceSave({ncc, so_hd, ngay, tien_hang, tien_thue})` → `vat_invoice` có dòng; `ledger` Nợ 133 = `tien_thue`.
2. Khi `phNhapCreate` có HĐĐT → tự lưu `vat_invoice` + bút toán Nợ 133 (như GĐ2 đã làm ở Plan_04).
3. `vatInvoiceSave(api, arg)`: validate, `db.transaction` → insert `vat_invoice`, post `Nợ 133 / Có 331` (hoặc cập nhật chứng từ nhập).
4. Báo cáo thuế: tổng `133` chưa khấu trừ = `SUM(vat_invoice.tien_thue WHERE chưa kết chuyển)`.

**Đối chiếu:** 133 (ledger) ≡ `SUM(vat_invoice.tien_thue)`.
**Rủi ro:** HĐĐT giả/thiếu → chỉ lưu, không tự xác thực (con người duyệt).
