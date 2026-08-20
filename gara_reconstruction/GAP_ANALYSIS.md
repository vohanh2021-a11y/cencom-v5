# GAP ANALYSIS v5.0 — Rác bỏ / Defer + Chức năng thiếu

## A. XỬ LÝ THEO 6 ĐIỀU CHỈNH

| # | Yêu cầu | Quyết định | Trạng thái code |
|---|---|---|---|
| 1 | Giữ báo giá (8 bước) | **GIỮ** `baogia`+`baogia_chitiet` | ❌ chưa code |
| 2 | Scoring ẩn | **DEFER** (phiên bản sau) | ❌ không tạo |
| 3 | Asset ẩn | **DEFER** | ❌ không tạo |
| 4 | Chữ ký → activity_log | **BỎ** `nhanKy` | ❌ chưa code activity |
| 5 | Ẩn chat/preview/thăm khám/bot | **DEFER** | ❌ không tạo |
| 6 | Bỏ duyệt/ngưỡng (thủ công) | **BỎ** `scDuyet`/`dmDuyet`/threshold | ❌ |

## B. CHỨC NĂNG NHIỄU ĐÃ LOẠI (rác ảo)
- `baogia` (v1 bỏ) → **v2 GIỮ** (sửa lỗi v1)
- `scoring`, `asset`, `chat`, `preview`, `tk`, `nhanKy`, `CencomBot` → ẩn/defer/bỏ
- 9 vai → 5 vai (4+admin)
- Ngưỡng duyệt 5tr, 8 chữ ký, 8 bước hồ sơ cồng kềnh → đơn giản

## C. CHỨC NĂNG THIẾU (cần bổ sung — ưu tiên)
1. **`activity_log` + `activityFeed`** ⭐ cốt lõi "theo dõi toàn bộ" — chưa có
2. **Dashboard Giám đốc độc lập** (KPI: xe đang sửa, chi phí, VT tồn thấp) — chưa có
3. **Hồ sơ kế toán tách rõ** (`ho_so`, không nằm asset) — chưa có
4. **Schema lean 12 bảng** (có baogia) — draft xong, **chưa migrate**
5. **Migrate + build core/api/ui theo 4 vai** — chưa làm (v4 đang GĐ0)

## D. KẾT LUẬN
- Thiết kế lean v3 ✅ hoàn tất (8 file trong `gara_reconstruction/`)
- **v3 đổi mô hình quyền**: `giamdoc` = QUYỀN KIỂM TRA (xem mọi thứ);
  `admin` = quản trị mạng (chỉ XEM + test-create lưu 1 ngày, KHÔNG quyền nghiệp vụ).
  Xem `DIAGRAM.md` ma trận quyền.
- Sẵn sàng code: đã disambiguate → sang `dev-workflow`
- Ưu tiên: (1) activity_log, (2) schema migrate (có `is_test`+cron), (3) dashboard giamdoc

> Xem `PLAN.md` để biết lộ trình build chi tiết.
