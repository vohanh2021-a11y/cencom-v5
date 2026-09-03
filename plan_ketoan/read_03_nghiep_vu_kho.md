# read_03 — Nghiệp vụ Kho & đối chiếu kế toán

## 1. Quy trình kho (hiện có)
- **Nhập kho** (`kho.phNhapCreate`): tăng `vattu.ton`, cập nhật `vattu.gia = giá nhập`, ghi `vattu_gia_lich_su`, tính `phieu_nhap.tong`.
- **Xuất kho** (`kho.phXuatCreate` / `autoXuatSC`): giảm `vattu.ton`, `dgia` = `vattu.gia` (hiện tại) hoặc `gia_ngay`.
- **Tồn kho:** `tonKho` = Σ(ton×gia).

## 2. COGS — 2 phương pháp (cấu hình `ke_toan_setting.cogs_method`)
- **`binh_quan` (mặc định):** `vattu.gia` = giá bình quân gia quyền sau mỗi lần nhập.
  - Khi nhập: `gia_moi = (ton_cu*gia_cu + sl_moi*gia_moi_nhap) / (ton_cu + sl_moi)`.
  - Xuất: `thanh = sl_xuat * gia` (giá bình quân). Đơn giản, khớp `vattu.gia` hiện tại.
- **`fifo` (tùy chọn):** theo dõi lô (`ton_lot`): mỗi nhập = 1 lô (sl, gia, con_lai). Xuất tiêu thụ lô cũ nhất trước.
  - `thanh = Σ(sl tiêu thụ lô i × gia lô i)`.
  - Chính xác hơn, truy xuất được nguồn gốc; phù hợp nếu sau này có mua lô.

## 3. Đối chiếu Kế toán ↔ Kho (quan trọng)
- **Tài khoản 152 (Nguyên liệu, vật liệu)** phải có số dư = `kho.tonKho` (Σ ton×gia).
- Báo cáo `reconcile_152`: so sánh `SUM(ledger Nợ 152 − Có 152)` với `tonKho`; cảnh báo chênh lệch.
- Xuất kho cho SC → bút toán `Nợ 154 / Có 152` (giá vốn theo COGS method).

## 4. Hạch toán
| Nghiệp vụ kho | Bút toán |
|---|---|
| Nhập kho (chưa trả NCC) | Nợ 152, 133 / Có 331 |
| Nhập kho (trả ngay) | Nợ 152, 133 / Có 112 |
| Xuất cho SC (giá vốn) | Nợ 154 / Có 152 |
| Thanh lý VT hư | Nợ 112 (thu hồi) / Có 152 (giá trị), chênh → 632 |

> Kế toán và kho "theo sát": mọi move kho PHẢI sinh bút toán qua `ledgerPost` trong cùng transaction (xem Plan_04).
