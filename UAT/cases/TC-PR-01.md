# TC-PR-01 — Đề xuất mua vật tư

> **Miền nghiệp vụ**: Mua sắm vật tư
> **Vai thực hiện**: khoa  ·  **Vai liên quan**: khoa, pttb
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Đề xuất mua vật tư.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **khoa** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở Mua sắm / Đề xuất mua
   **Mong đợi**: Hiện form đề xuất
2. **Làm**: Chọn/nhập vật tư, số lượng, đơn giá dự kiến, lý do
   **Mong đợi**: Form nhận giá trị
3. **Làm**: Liên kết phiếu sửa chữa (nếu từ sửa chữa)
   **Mong đợi**: Gắn được SC
4. **Làm**: Bấm Gửi đề xuất
   **Mong đợi**: Vào danh sách chờ duyệt

## 2. Kết quả kỳ vọng
Đề xuất nằm trong danh sách chờ duyệt mua.

## 3. Tiêu chí đạt (verify)
Lưu đủ; truy vết được về SC gốc.

## 4. Tính năng ẩn có thể phát sinh
Trang Mua sắm / Đề xuất mua (có thể chưa có → bổ sung).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-PR-01.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-PR-01`*
