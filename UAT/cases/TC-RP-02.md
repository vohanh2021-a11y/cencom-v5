# TC-RP-02 — Xưởng trưởng lập phiếu sửa chữa (SC) bằng quy trình 8 bước

> **Miền nghiệp vụ**: Sửa chữa xe
> **Vai thực hiện**: xuong  ·  **Vai liên quan**: xuong
> **Ưu tiên**: 1  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Xưởng trưởng lập phiếu sửa chữa (SC) bằng quy trình 8 bước.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **xuong** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở Sửa chữa / Tạo phiếu mới
   **Mong đợi**: Mở wizard bước 1
2. **Làm**: B1: nhập biển số, loại xe, ngày tiếp nhận
   **Mong đợi**: Chuyển bước 2
3. **Làm**: B2: nhập mô tả hỏng hóc, nguyên nhân nghi ngờ
   **Mong đợi**: Chuyển bước 3
4. **Làm**: B3: thêm các công việc sửa chữa
   **Mong đợi**: Danh sách công việc hiện ra
5. **Làm**: B4: với mỗi vật tư chọn Thay thế/Khắc phục + số lượng (ưu tiên gợi ý tồn kho)
   **Mong đợi**: Vật tư lưu, có gợi ý hàng tồn
6. **Làm**: B5-B7: xác nhận ước tính, gán kỹ thuật viên
   **Mong đợi**: Chuyển bước 8
7. **Làm**: B8: bấm Tạo phiếu
   **Mong đợi**: Sinh mã SC-xxxxxx, về màn hình chi tiết

## 2. Kết quả kỳ vọng
Phiếu sửa chữa được tạo, trạng thái 'Chờ duyệt'.

## 3. Tiêu chí đạt (verify)
Mã phiếu đúng định dạng; công việc & vật tư lưu đủ; trạng thái đầu là Chờ duyệt.

## 4. Tính năng ẩn có thể phát sinh
Wizard 8 bước đã có (sc/create). Cần xác nhận gợi ý vật tư tồn kho hiển thị.

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-RP-02.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-RP-02`*
