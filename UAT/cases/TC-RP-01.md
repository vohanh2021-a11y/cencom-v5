# TC-RP-01 — Lái xe đề xuất sửa chữa cho một xe

> **Miền nghiệp vụ**: Sửa chữa xe
> **Vai thực hiện**: laixe  ·  **Vai liên quan**: laixe, xuong
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Lái xe đề xuất sửa chữa cho một xe.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **laixe** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở menu Xe / Đề xuất sửa chữa
   **Mong đợi**: Hiện form đề xuất
2. **Làm**: Nhập biển kiểm soát (vd 51C-12345)
   **Mong đợi**: Ô biển số nhận giá trị
3. **Làm**: Nhập mô tả hỏng hóc (vd 'Máy không nổ')
   **Mong đợi**: Ô mô tả nhận giá trị
4. **Làm**: Bấm Gửi đề xuất
   **Mong đợi**: Hệ thống báo 'Đã gửi'

## 2. Kết quả kỳ vọng
Đề xuất xuất hiện trong danh sách chờ xưởng xử lý; lái xe không nhập chi phí.

## 3. Tiêu chí đạt (verify)
Đề xuất của lái xe nằm trong hệ thống; không có trường chi phí.

## 4. Tính năng ẩn có thể phát sinh
Cần trang/menu 'Xe / Đề xuất sửa chữa' (có thể chưa có → bổ sung).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-RP-01.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-RP-01`*
