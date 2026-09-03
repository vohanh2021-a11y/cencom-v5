# TC-PR-02 — Duyệt đề xuất mua

> **Miền nghiệp vụ**: Mua sắm vật tư
> **Vai thực hiện**: giamdoc  ·  **Vai liên quan**: giamdoc, pttb
> **Ưu tiên**: 2  ·  **Trạng thái**: chưa chạy

## 1. Kịch bản (AI đọc)
Mục tiêu: Duyệt đề xuất mua.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **giamdoc** (mật khẩu chung `cencom@123`).

### Các bước (plan-task)
1. **Làm**: Mở đề xuất mua, xem vật tư & số tiền
   **Mong đợi**: Hiện chi tiết
2. **Làm**: Bấm Duyệt (hoặc Từ chối kèm lý do)
   **Mong đợi**: Đề xuất sang Đã duyệt (hoặc bị từ chối)

## 2. Kết quả kỳ vọng
Đề xuất đã duyệt → có thể lập đơn hàng.

## 3. Tiêu chí đạt (verify)
Chỉ người có thẩm quyền bấm được Duyệt.

## 4. Tính năng ẩn có thể phát sinh
Quyền duyệt mua (ROLE_RESTRICT cho mua.duy).

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | `UAT/videos/TC-PR-02.webm` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: `pwsh UAT/run-case.ps1 TC-PR-02`*
