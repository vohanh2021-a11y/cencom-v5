# read_04 — Nghiệp vụ Mua & công nợ NCC

## 1. Quy trình mua (hiện có)
- Đề xuất mua (`de_xuat`/`dm*`) → Báo giá NCC (`baoGia*`) → Nhập kho (`phNhapCreate`).
- NCC hiện chỉ là **text tự do** (`phieu_nhap.nha_cc`, `bao_gia_ncc.ncc_ten`) → KHÔNG có master NCC.

## 2. Cần bổ sung (GĐ3)
- **Master NCC:** tái sử dụng `khach_hang` (đã có trường `ma_so_thue`) hoặc bảng `nha_cung_cap`. Quyết định: dùng `khach_hang` làm đối tác chung (có `ma_so_thue`) để đơn giản, phân biệt bằng cờ `la_ncc`.
- **Công nợ phải trả (`cong_no` loại `phai_tra`):** sinh khi nhập kho chưa trả; giảm khi thanh toán (`phieuChiCreate`).
  - `so_tien` (gốc), `da_tt`, `con_no = so_tien − da_tt`, `han_tt`, `ky` (tuổi nợ).
- **HĐĐT đầu vào (`vat_invoice`):** lưu `so_hd, ngay, tien_hang, tien_thue, ty_le` từ NCC → hạch toán Nợ 133.

## 3. Hạch toán
| Nghiệp vụ mua | Bút toán |
|---|---|
| Nhập kho + HĐĐT (chưa trả) | Nợ 152, **133** / Có 331 |
| Nhập kho + HĐĐT (trả ngay) | Nợ 152, 133 / Có 112 |
| Thanh toán NCC | Nợ 331 / Có 112 (hoặc 111) |
| Thuế: 133 được khấu trừ | Theo dõi riêng, báo cáo thuế |

## 4. Đối chiếu
- Số dư 331 (ledger) phải = `SUM(cong_no.con_no WHERE loai='phai_tra')`.
- Báo cáo công nợ NCC + tuổi nợ (quá hạn theo `han_tt`).
