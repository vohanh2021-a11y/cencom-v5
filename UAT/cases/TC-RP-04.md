# TC-RP-04 — Thợ thực hiện & Nghiệm thu, đóng phiếu

> **Miền nghiệp vụ**: Sửa chữa xe
> **Vai thực hiện**: xuong  ·  **Vai liên quan**: xuong
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Thợ thực hiện & Nghiệm thu, đóng phiếu.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **xuong** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở phiếu đã duyệt, cập nhật tiến độ từng công việc
   **Mong đợi**: Trạng thái công việc đổi
2. **Làm**: Khi xong hết, bấm Nghiệm thu
   **Mong đợi**: Phiếu sang Đã nghiệm thu
3. **Làm**: Kiểm tra vật tư xuất kho khớp thực tế
   **Mong đợi**: Khớp
4. **Làm**: Bấm Đóng phiếu
   **Mong đợi**: Trạng thái Chờ quyết toán, ghi ngày hoàn thành

## 2. Kết quả kỳ vọng
Phiếu Đã nghiệm thu / Chờ quyết toán, có ngày hoàn thành.

## 3. Tiêu chí đạt (verify)
Không thể Đóng phiếu khi còn công việc chưa xong.

## 4. Tính năng ẩn có thể phát sinh
Nút Nghiệm thu / Đóng phiếu (có thể chưa có → bổ sung).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-RP-04.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-RP-04`*
