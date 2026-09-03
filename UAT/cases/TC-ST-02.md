# TC-ST-02 — CHẶN thanh toán khi thiếu HĐĐT (luật cứng QC206)

> **Miền nghiệp vụ**: Quyết toán & báo cáo
> **Vai thực hiện**: ketoan  ·  **Vai liên quan**: ketoan
> **Ưu tiên**: 0  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: CHẶN thanh toán khi thiếu HĐĐT (luật cứng QC206).
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **ketoan** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở phiếu sửa chữa / mua CHƯA gắn HĐĐT
   **Mong đợi**: Hiện chi tiết, thiếu HĐĐT
2. **Làm**: Thử bấm Quyết toán / Thanh toán
   **Mong đợi**: Hệ thống BÁO LỖI rõ ràng, KHÔNG lưu

## 2. Kết quả kỳ vọng
Báo 'Chưa có HĐĐT, không được thanh toán'; quyết toán bị chặn.

## 3. Tiêu chí đạt (verify)
Không quyết toán được khi thiếu HĐĐT. ⭐ Quan trọng nhất QC206.

## 4. Tính năng ẩn có thể phát sinh
Logic chặn HĐĐT ở backend (P2.2a) — phải đảm bảo có check; nếu thiếu → bổ sung.

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-ST-02.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-ST-02`*
