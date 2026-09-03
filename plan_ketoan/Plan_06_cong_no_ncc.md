# Plan_06 — Công nợ NCC & Phiếu chi  ·  Chức năng: Công nợ  ·  GĐ3

**Đầu vào:** nhập kho chưa trả (GĐ2 sinh Nợ 331), thanh toán NCC.
**Đầu ra:** `cong_no` (phai_tra) + `phieuChiCreate` + tuổi nợ.

## Các bước (TDD)
1. Test: `phNhapCreate` chưa trả → `cong_no` có `con_no = tien`. `phieuChiCreate(cong_no_id, so_tien)` → `con_no` giảm, `da_tt` tăng; `ledger` Nợ 331 / Có 112.
2. Thêm master NCC: tái dùng `khach_hang` (có `ma_so_thue`) với cờ `la_ncc=true` (hoặc bảng `nha_cung_cap` — chọn theo quyết định).
3. `ledgerPost` mở rộng: khi `ref_type='phieu_nhap'` và chưa trả → đồng thời ghi `cong_no` (phai_tra) trong tx.
4. `phieuChiCreate(api, {cong_no_id, so_tien, ngay})`: `db.transaction` → giảm `cong_no`, post `Nợ 331 / Có 112`.
5. `congNoList(api, {loai:'phai_tra', qua_han?})`: trả danh sách + `con_no`; tính tuổi nợ theo `han_tt`.
6. Đối chiếu: số dư 331 (ledger) ≡ `SUM(cong_no.con_no WHERE phai_tra)`.

**Đối chiếu:** Kế toán (331) ↔ Công nợ (cong_no) phải khớp.
**Rủi ro:** thanh toán vượt `con_no` → chặn (so_tien > con_no).
