# TC-ST-01 — Quyết toán phiếu sửa chữa

> **Miền nghiệp vụ**: Quyết toán & báo cáo
> **Vai thực hiện**: ketoan  ·  **Vai liên quan**: ketoan
> **Ưu tiên**: 1  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Quyết toán phiếu sửa chữa.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **ketoan** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở phiếu sửa chữa đã nghiệm thu
   **Mong đợi**: Hiện chi tiết
2. **Làm**: Mở Quyết toán, kiểm tra công việc, vật tư, phụ phí vận chuyển
   **Mong đợi**: Hiện đủ các khoản
3. **Làm**: Bấm Quyết toán
   **Mong đợi**: Phiếu sang Đã quyết toán

## 2. Kết quả kỳ vọng
Phiếu Đã quyết toán; tổng = công việc + vật tư + phụ phí.

## 3. Tiêu chí đạt (verify)
Tổng chi phí đúng, không âm, không nhảy số.

## 4. Tính năng ẩn có thể phát sinh
Chức năng Quyết toán + trường cp_ve_phuphi (migration 0002 đã có cột).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-ST-01.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-ST-01`*
