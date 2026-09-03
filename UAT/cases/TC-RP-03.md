# TC-RP-03 — Duyệt phiếu sửa chữa theo thẩm quyền

> **Miền nghiệp vụ**: Sửa chữa xe
> **Vai thực hiện**: xuong  ·  **Vai liên quan**: xuong, giamdoc
> **Ưu tiên**: 1  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Duyệt phiếu sửa chữa theo thẩm quyền.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **xuong** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở Sửa chữa / Danh sách, mở phiếu chờ duyệt
   **Mong đợi**: Hiện chi tiết phiếu
2. **Làm**: Xem công việc, vật tư, tổng ước tính
   **Mong đợi**: Hiện đầy đủ
3. **Làm**: Bấm Duyệt (hoặc Từ chối nếu sai)
   **Mong đợi**: Trạng thái sang Đang sửa chữa (hoặc Chờ sửa + ghi chú)

## 2. Kết quả kỳ vọng
Duyệt → Đang sửa chữa. Từ chối → Chờ sửa có lý do.

## 3. Tiêu chí đạt (verify)
Trạng thái thay đổi đúng; người không có quyền không thấy nút Duyệt.

## 4. Tính năng ẩn có thể phát sinh
Nút Duyệt/Từ chối trên chi tiết SC (có thể chưa có → bổ sung).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-RP-03.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-RP-03`*
