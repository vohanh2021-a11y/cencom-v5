# TC-ST-04 — Báo cáo chi phí theo xe / theo thời gian

> **Miền nghiệp vụ**: Quyết toán & báo cáo
> **Vai thực hiện**: giamdoc  ·  **Vai liên quan**: giamdoc, ketoan
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Báo cáo chi phí theo xe / theo thời gian.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **giamdoc** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở Báo cáo / Chi phí
   **Mong đợi**: Hiện form báo cáo
2. **Làm**: Chọn theo xe (nhập biển) hoặc theo khoảng thời gian
   **Mong đợi**: Hiện số liệu
3. **Làm**: Xem tổng chi phí
   **Mong đợi**: 3 bên (sửa chữa/mua/kho) hiển thị riêng biệt

## 2. Kết quả kỳ vọng
Tổng chi phí tách biệt 3 bên, không cộng nhầm.

## 3. Tiêu chí đạt (verify)
Số liệu = tổng phiếu đã quyết toán trong kỳ.

## 4. Tính năng ẩn có thể phát sinh
Trang Báo cáo chi phí (có thể chưa có → bổ sung).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-ST-04.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-ST-04`*
