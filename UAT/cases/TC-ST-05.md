# TC-ST-05 — Đối soát 3 bên (sửa chữa – mua – kho)

> **Miền nghiệp vụ**: Quyết toán & báo cáo
> **Vai thực hiện**: ketoan  ·  **Vai liên quan**: ketoan
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Đối soát 3 bên (sửa chữa – mua – kho).
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **ketoan** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở báo cáo, so sánh vật tư xuất cho SC = vật tư nhập từ mua
   **Mong đợi**: Hiện đối soát
2. **Làm**: Kiểm tra chi phí sửa chữa không chứa mua chưa nhập kho
   **Mong đợi**: Khớp hoặc cảnh báo lệch

## 2. Kết quả kỳ vọng
Số liệu 3 luồng khớp; lệch thì có cảnh báo.

## 3. Tiêu chí đạt (verify)
Không có chi phí 'treo' không giải trình được.

## 4. Tính năng ẩn có thể phát sinh
Báo cáo đối soát (có thể chưa có → bổ sung).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-ST-05.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-ST-05`*
