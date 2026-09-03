# TC-ST-03 — Xuất hồ sơ 9 tab (giới hạn vai)

> **Miền nghiệp vụ**: Quyết toán & báo cáo
> **Vai thực hiện**: ketoan  ·  **Vai liên quan**: ketoan, giamdoc, laixe, xuong
> **Ưu tiên**: 1  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Xuất hồ sơ 9 tab (giới hạn vai).
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **ketoan** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Đăng nhập ketoan-1/giamdoc-1, mở phiếu, bấm Xuất hồ sơ (9 tab)
   **Mong đợi**: Tải được file Excel 9 sheet
2. **Làm**: Đăng nhập laixe-1/xuong-1, mở cùng phiếu, thử Xuất hồ sơ
   **Mong đợi**: Bị từ chối (không nút hoặc báo Không có quyền)

## 2. Kết quả kỳ vọng
Kế toán/Giám đốc tải được; lái xe/xưởng bị chặn.

## 3. Tiêu chí đạt (verify)
Phân quyền xuất hồ sơ đúng theo ROLE_RESTRICT.

## 4. Tính năng ẩn có thể phát sinh
(Đã có scHoSoXlsx + ROLE_RESTRICT — xác nhận đủ trên UI).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-ST-03.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-ST-03`*
