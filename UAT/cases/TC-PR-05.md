# TC-PR-05 — Xuất kho cho phiếu sửa chữa

> **Miền nghiệp vụ**: Mua sắm vật tư
> **Vai thực hiện**: khoa  ·  **Vai liên quan**: khoa, xuong
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Xuất kho cho phiếu sửa chữa.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **khoa** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở phiếu sửa chữa, mục Vật tư, bấm Xuất kho
   **Mong đợi**: Hệ thống trừ tồn kho
2. **Làm**: Xác nhận số lượng xuất
   **Mong đợi**: Phiếu ghi nhận vật tư đã xuất

## 2. Kết quả kỳ vọng
Tồn kho giảm; SC ghi nhận vật tư xuất.

## 3. Tiêu chí đạt (verify)
Không thể xuất nhiều hơn tồn kho thực tế.

## 4. Tính năng ẩn có thể phát sinh
UI xuất kho từ SC (module kho).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-PR-05.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-PR-05`*
