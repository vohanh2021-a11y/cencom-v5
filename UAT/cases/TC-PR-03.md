# TC-PR-03 — Lập phiếu mua / Đơn hàng

> **Miền nghiệp vụ**: Mua sắm vật tư
> **Vai thực hiện**: khoa  ·  **Vai liên quan**: khoa
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Lập phiếu mua / Đơn hàng.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **khoa** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Từ đề xuất đã duyệt, bấm Tạo phiếu mua
   **Mong đợi**: Mở form phiếu mua
2. **Làm**: Kiểm tra vật tư, số lượng, đơn giá, nhà cung cấp
   **Mong đợi**: Hiện đúng
3. **Làm**: Bấm Lưu phiếu mua
   **Mong đợi**: Sinh MUA-xxxxxx, Chờ nhập kho

## 2. Kết quả kỳ vọng
Phiếu mua tạo, trạng thái Chờ nhập kho.

## 3. Tiêu chí đạt (verify)
Số tiền không vượt đề xuất đã duyệt (cảnh báo nếu vượt).

## 4. Tính năng ẩn có thể phát sinh
Phiếu mua (module mua) — cần xác nhận tồn tại.

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-PR-03.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-PR-03`*
