# TC-RP-05 — Phân quyền xem phiếu sửa chữa theo vai

> **Miền nghiệp vụ**: Sửa chữa xe
> **Vai thực hiện**: laixe  ·  **Vai liên quan**: laixe, xuong, ketoan, giamdoc
> **Ưu tiên**: 1  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Phân quyền xem phiếu sửa chữa theo vai.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **laixe** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Đăng nhập laixe-1, mở phiếu
   **Mong đợi**: Thấy trạng thái, KHÔNG thấy chi phí
2. **Làm**: Đăng nhập xuong-1, mở phiếu
   **Mong đợi**: Thấy công việc/vật tư, KHÔNG có nút Xuất hồ sơ
3. **Làm**: Đăng nhập ketoan-1/giamdoc-1, mở phiếu
   **Mong đợi**: Thấy đầy đủ + có nút Xuất hồ sơ

## 2. Kết quả kỳ vọng
Lái xe & xưởng không truy cập được chi phí; kế toán/giám đốc được.

## 3. Tiêu chí đạt (verify)
Phân quyền hiển thị đúng theo vai.

## 4. Tính năng ẩn có thể phát sinh
(Đã có StatusPipeline / ScHoSoPanel — xác nhận đủ).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-RP-05.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-RP-05`*
