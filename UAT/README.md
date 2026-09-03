# UAT/ — Khung UAT tự động (Quy chế 206, Garage 4.0)

Thư mục này chứa toàn bộ kịch bản UAT chạy tự động, báo cáo kết quả từng phiên, và xuất video
đặt tên theo từng case để người dùng xem nhanh. Mỗi case có thể **bộc lộ tính năng ẩn**
(khi chạy mới thấy thiếu giao diện/chức năng) → bổ sung rồi chạy lại.

## 1. Cấu trúc
```
UAT/
├─ README.md                  # tài liệu này (quy trình step-by-step)
├─ cases/
│  ├─ index.json              # NGUỒN DỮ LIỆU: 15 case (AI đọc + máy chạy)
│  ├─ generate.mjs            # sinh file .md cho từng case từ index.json
│  ├─ TC-RP-01.md ... TC-ST-05.md   # kịch bản AI đọc + plan-task + template báo cáo
│  └─ execute.spec.ts         # Playwright: đọc index.json, chạy case theo vai, ghi video
├─ playwright.config.ts       # cấu hình: webServer, 7 project theo vai, video:'on'
├─ rename-videos.mjs          # đổi tên video Playwright → UAT/videos/<TC-ID>.webm
├─ run-case.ps1 <id>          # chạy 1 case: login vai → chạy → đổi tên video → báo cáo
├─ run-all.ps1                # chạy toàn bộ 15 case, tổng hợp báo cáo
├─ videos/                    # UAT/videos/<TC-ID>.webm  (video đặt tên theo case)
└─ reports/                   # UAT/reports/<TC-ID>.md + SUMMARY.md (kết quả từng phiên)
```

## 2. Quy trình step-by-step xử lý cụm UAT (tự động mỗi phiên)

Với MỖI case (lặp 15 lần):

1. **Đọc kịch bản** — máy đọc `cases/index.json` (trường `steps`, `expect`, `verify`) và
   file `cases/<id>.md` (kịch bản AI đọc). Xác định `role` (vai thực hiện).
2. **Chuẩn bị môi trường** — đảm bảo DB có user UAT (`node scripts/ensure-uat-users.mjs`),
   dev server tự dựng qua `webServer` (Playwright quản lý vòng đời).
3. **Chạy plan-task** — `execute.spec.ts` đăng nhập vai, thực hiện từng bước `steps`,
   tại mỗi bước kiểm tra `expect`. Quay video toàn bộ (Playwright `video:'on'`).
4. **Đổi tên video** — `rename-videos.mjs` copy video kết quả → `videos/<TC-ID>.webm`
   (tên case gắn sẵn để người dùng nhận diện).
5. **Kiểm tra kết quả** — so sánh thực tế với `verify` (tiêu chí đạt). Ghi `Pass`/`Fail`/
   `Cần bổ sung tính năng`.
6. **Báo cáo** — ghi `reports/<TC-ID>.md` (chi tiết) + cập nhật `reports/SUMMARY.md`
   (tổng hợp, dùng cho báo cáo mỗi phiên).
7. **Phát hiện tính năng ẩn** — nếu bước nào không tìm thấy UI/phản hồi đúng → đánh dấu case
   `Cần bổ sung tính năng`, liệt kê chức năng thiếu, rồi implement (bổ sung UI/nghiệp vụ),
   sau đó chạy lại case từ bước 3 đến khi `Pass`.

Lặp cho đến khi 15/15 case `Pass`.

## 3. Quy ước đặt tên video (QUAN TRỌNG)
- File video luôn là `UAT/videos/<TC-ID>.webm` (vd `UAT/videos/TC-ST-02.webm`).
- Người dùng mở đúng file theo mã case trong `reports/SUMMARY.md` để xem nhanh quy trình.
- Nếu 1 case có nhiều luồng (nhiều vai), video vẫn lấy tên case; luồng phụ ghi chú trong report.

## 4. Chạy thủ công
```powershell
# 1 case
pwsh UAT/run-case.ps1 TC-ST-02

# toàn bộ
pwsh UAT/run-all.ps1
```
Yêu cầu: `npx playwright install chromium` (đã cài), DB local đang chạy, `node scripts/ensure-uat-users.mjs`.

## 5. Báo cáo mỗi phiên
- `UAT/reports/SUMMARY.md` cập nhật sau mỗi lần chạy (kể cả chạy dở 1 case).
- Mỗi phiên báo cáo: số case Pass / Fail / Cần bổ sung, video tương ứng, tính năng ẩn đã tìm ra.
- Trạng thái từng case cũng lưu trong `cases/index.json` (trường `status`) để theo dõi xuyên phiên.

## 6. Danh sách case (15)
Sửa chữa: TC-RP-01..05 · Mua sắm: TC-PR-01..05 · Quyết toán: TC-ST-01..05
(Xem chi tiết trong `cases/index.json` và `cases/<id>.md`.)
