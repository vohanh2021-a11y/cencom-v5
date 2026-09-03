# read_05 — Chi phí nhân công

## 1. Hai loại nhân công
- **Trong (thợ nội bộ):** lương/thưởng → `Nợ 622 / Có 334` (sau đó `334 → 111/112` khi trả lương).
- **Ngoài (đơn vị/DV sửa chữa):** chi phí thuê → `Nợ 622 / Có 331` (NCC dịch vụ), theo dõi qua `cong_no` (phai_tra).

## 2. Hiện trạng code
- `sc.ts`: `sc_congviec` có `don_gia`, `thanh = so_luong×don_gia`, `la_sua_ngoai` (phân biệt trong/ngoài).
- `asset.ts`: `ncNgoaiReport` tổng hợp chi phí nhân công ngoài theo `don_vi_ngoai`.

## 3. Hạch toán (kế toán)
| Nghiệp vụ | Bút toán |
|---|---|
| Công việc thợ nội bộ (tính vào CP SC) | Nợ 622 / Có 334 |
| Thuê ngoài (DV sửa chữa) | Nợ 622 / Có 331 |
| Trả lương thợ | Nợ 334 / Có 112 (hoặc 111) |

## 4. Tích hợp (GĐ2)
- Khi SC `recalc`/`quyetToan`, chi phí nhân công (từ `sc_congviec`) được tập hợp vào `154` (qua 622) rồi kết chuyển `642`/`241`.
- Nhân công ngoài: sinh `cong_no` (phai_tra) bên cạnh bút toán 622/331.
- `ncNgoaiReport` giữ nguyên (parity), bổ sung cột bút toán tương ứng.
