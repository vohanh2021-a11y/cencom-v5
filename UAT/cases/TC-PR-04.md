# TC-PR-04 — Nhập kho vật tư

> **Miền nghiệp vụ**: Mua sắm vật tư
> **Vai thực hiện**: khoa  ·  **Vai liên quan**: khoa
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Nhập kho vật tư.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **khoa** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở phiếu mua, bấm Nhập kho
   **Mong đợi**: Mở form nhập
2. **Làm**: Nhập số lượng thực nhận, ngày nhập
   **Mong đợi**: Form nhận giá trị
3. **Làm**: Xác nhận
   **Mong đợi**: Tồn kho tăng đúng số lượng

## 2. Kết quả kỳ vọng
Tồn kho vật tư tăng; phiếu sang Đã nhập.

## 3. Tiêu chí đạt (verify)
Tồn sau = trước + thực nhận.

## 4. Tính năng ẩn có thể phát sinh
UI nhập kho (module kho).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-PR-04.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-PR-04`*
