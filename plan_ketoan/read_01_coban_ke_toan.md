# read_01 — Cơ bản kế toán VAS (cost-side)

## 1. Nguyên tắc VAS (TT200/2014, rút gọn cho nội bộ)
- Mọi nghiệp vụ được ghi bằng **bút toán kép**: mỗi nghiệp vụ sinh ít nhất 1 Nợ và 1 Có, tổng Nợ = tổng Có.
- Tài khoản phân loại: `tai_san` (số dư Nợ), `no_phai_tra` (số dư Có), `von_chu_so_huu` (Có), `chi_phi` (tập hợp rồi kết chuyển), `doanh_thu` (KHÔNG dùng vì nội bộ).
- Kỳ kế toán: kết chuyển chi phí vào `911` (XĐ KQKD) — với nội bộ, Báo cáo KQHĐKD chỉ phản ánh **chi phí** (không có doanh thu).

## 2. Hệ thống tài khoản (CoA) seed — `tai_khoan`
| Mã | Tên | Loại |
|---|---|---|
| 111 | Tiền mặt | tai_san |
| 112 | Tiền gửi ngân hàng | tai_san |
| 152 | Nguyên liệu, vật liệu (vật tư phụ tùng) | tai_san |
| 153 | Công cụ dụng cụ | tai_san |
| 154 | Chi phí SXKD dở dang (tập hợp CP sửa chữa) | tai_san |
| 156 | Hàng hóa | tai_san |
| 211 | TSCĐ hữu hình (xe đầu kéo) | tai_san |
| 214 | Hao mòn TSCĐ | tai_san |
| 241 | XDCB dở dang (nâng cấp lớn) | tai_san |
| 331 | Phải trả người bán (NCC) | no_phai_tra |
| 3331 | Thuế GTGT phải nộp | no_phai_tra |
| 334 | Phải trả người laoồng | no_phai_tra |
| 421 | Lợi nhuận chưa phân phối | von_chu_so_huu |
| 621 | Chi phí NVL trực tiếp | chi_phi |
| 622 | Chi phí nhân công trực tiếp | chi_phi |
| 627 | Chi phí sản xuất chung (khấu hao, điện...) | chi_phi |
| 641 | Chi phí bán hàng | chi_phi |
| 642 | Chi phí quản lý doanh nghiệp | chi_phi |
| 911 | Xác định kết quả kinh doanh | chi_phi |
| 632 | Giá vốn hàng bán | chi_phi |

> Không seed 131 (AR), 511 (doanh thu), 711 (thu nhập khác) — nội bộ không dùng.

## 3. Mẫu định khoản (xem `read_06` cho 8 bước)
- Mua VT nhập kho (chưa trả): `Nợ 152, 133 / Có 331`
- Xuất VT cho SC: `Nợ 154 / Có 152`
- Lương thợ: `Nợ 622 / Có 334`
- Thuê ngoài: `Nợ 622 / Có 331`
- Khấu hao xe: `Nợ 627 / Có 214`
- Quyết toán SC (thường): `Nợ 642 / Có 154`
- Quyết toán SC (nâng cấp lớn): `Nợ 241 / Có 154`
- Thanh toán NCC: `Nợ 331 / Có 112`
- Khóa kỳ: `Nợ 911 / Có 642,627,622,621`

## 4. Ràng buộc bắt buộc
- `ledger.du_no`/`du_co`: đúng 1 trong 2 > 0 (`CHECK (du_no>0 AND du_co=0) OR (du_co>0 AND du_no=0)`).
- Mỗi `chung_tu`: `SUM(du_no) = SUM(du_co)` (kiểm tra trong transaction, sai → rollback).
- Tiền: `NUMERIC(14,2)` cho bảng mới (bảng cũ giữ `REAL` để tương thích ngược).
