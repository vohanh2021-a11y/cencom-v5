# read_06 — Quy trình 8 bước nhập–xuất xe → bút toán VAS

> Áp dụng nguyên tắc "quy trình 8 bước" cho việc nhập xe (tiếp nhận) → xuất xe (giao). Mỗi bước sinh sự kiện kế toán (nếu có tiền).

| # | Bước (nhập xe → xuất xe) | Sự kiện tài chính | Bút toán VAS |
|---|---|---|---|
| 1 | Tiếp nhận xe (SC draft) | Mở hồ sơ (chưa tiền) | — |
| 2 | Kiểm tra & chẩn đoán | Ước tính chi phí (draft) | — |
| 3 | Báo giá nội bộ | Chưa có khách → không bút toán | — |
| 4 | Lập lệnh sửa chữa (RO) | Chốt kế hoạch | — |
| 5a | **Nhập vật tư (NCC + HĐĐT)** | Mua VT | **Nợ 152, 133 / Có 331 (hoặc 112)** |
| 5b | **Xuất VT cho SC (giá vốn)** | CP sửa chữa | **Nợ 154 / Có 152** (COGS) |
| 5c | **Nhân công (trong/ngoài)** | CP nhân công | **Nợ 622 / Có 334** (trong) hoặc **/ Có 331** (ngoài) |
| 6 | Nghiệm thu (QC) | Snapshot `bien_ban_nghiem` | — (không bút toán) |
| 7 | **Quyết toán SC** | Chốt CP | **Nợ 642** (thường) hoặc **241** (nâng cấp) / **Có 154** |
| 8 | Giao xe (xuất xe) | Đóng phiếu | — (không bút toán tiền; khấu hao chạy định kỳ) |
| Định kỳ | **Khấu hao xe** | Phân bổ giá trị | **Nợ 627 / Có 214** |
| Định kỳ | **Thanh toán NCC** | Trả nợ mua | **Nợ 331 / Có 112** |

## Ghi chú quy tắc kết chuyển
- **Sửa chữa thường xuyên** → `Nợ 642` (CP quản lý DN).
- **Nâng cấp lớn** (làm tăng công năng/thời gian sử dụng TSCĐ) → `Nợ 241` (XDCB dở dang), sau đó `241 → 211` khi hoàn thành.
- Mọi bút toán phải sinh từ 1 `chung_tu` có `ref_type/ref_id` (VD `ref_type='phieu_nhap'`, `ref_id=...`) để truy xuất ngược giữa kế toán và kho/mua/SC.

## Đối chiếu chéo (yêu cầu "kế toán và kho theo sát")
- Bước 5b (xuất kho) sinh `Nợ 154 / Có 152` → số dư 152 phải khớp `kho.tonKho`.
- Bước 5a (nhập) sinh `Nợ 152 / Có 331` + `133` → số dư 331 phải khớp `cong_no` NCC; 133 theo dõi riêng (thuế).
- Bước 7 (quyết toán) sinh `Nợ 642/241 / Có 154` → tổng Nợ 154 của 1 SC phải = `lich_sua.tong` (chi phí quyết toán).
