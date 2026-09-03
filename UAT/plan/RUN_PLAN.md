# UAT/plan/RUN_PLAN.md — Kế hoạch chạy UAT từng case đến khi Đạt

## Nguyên tắc (theo yêu cầu)
1. **(a)** Chạy TẤT CẢ 15 case. Với mỗi case: chạy → nếu FAIL → implement tính năng thiếu → chạy lại → lặp đến khi **Đạt**.
2. **(b)** Trước mỗi đợt chạy, **đảm bảo dev server sạch** (không dùng bản cũ). Khi **15/15 Đạt** → mới "đạt tiêu chuẩn".
3. **(c)** Case **TC-ST-02 (chặn thanh toán thiếu HĐĐT)** là quan trọng nhất (luật cứng Quy chế 206 P2.2a) → kiểm tra kỹ, ưu tiên làm đầu tiên.

## Thứ tự ưu tiên
| STT | Case | Lý do ưu tiên |
|---|---|---|
| 1 | TC-ST-02 | Quan trọng nhất QC206 (chặn HĐĐT) |
| 2 | TC-RP-02 | Lập SC (luồng cốt lõi, đang fail redirect) |
| 3 | TC-RP-03 | Duyệt phiếu |
| 4 | TC-RP-05 | Phân quyền xem |
| 5 | TC-ST-01 | Quyết toán |
| 6 | TC-ST-03 | Xuất hồ sơ giới hạn vai |
| 7 | TC-ST-04 | Báo cáo chi phí |
| 8 | TC-ST-05 | Đối soát 3 bên |
| 9 | TC-RP-04 | Nghiệm thu/đóng phiếu |
| 10 | TC-PR-01 | Đề xuất mua |
| 11 | TC-PR-02 | Duyệt mua |
| 12 | TC-PR-03 | Lập phiếu mua |
| 13 | TC-PR-04 | Nhập kho |
| 14 | TC-PR-05 | Xuất kho |
| 15 | TC-RP-01 | Đề xuất sửa chữa (lái xe) |

## Quy trình sạch server (bắt buộc trước mỗi đợt)
- Script `run-case.ps1` / `run-all.ps1` sẽ **kill process đang chiếm port 3000** trước khi Playwright khởi động, đảm bảo dev server build lại code mới nhất.
- `playwright.config.ts` giữ `reuseExistingServer: true` → nếu port trống sẽ tự dựng server mới (sạch).

## Định nghĩa "Đạt"
- Test chạy qua (Playwright exit 0) VÀ hành vi khớp `verify` trong `cases/index.json`.
- Video `UAT/videos/<TC-ID>.webm` sinh ra.
- Ghi vào `LOG.md` + cập nhật `STATUS.md` + `reports/SUMMARY.md`.

## Nhật ký
- `UAT/plan/LOG.md`: ghi liên tục từng lần chạy (ngày, case, kết quả, tính năng ẩn bộc lộ, cách sửa, kết quả sau sửa).
- `UAT/plan/STATUS.md`: bảng tổng hợp 15 case.
