# gara_reconstruction — Thiết kế ngược từ 4 vai trò (LEAN v5.0)

> **Phiên bản**: v5.0.0 — bản lean rebuild từ v4.0.0, theo yêu cầu mới (4 vai + theo dõi,
> giữ báo giá, ẩn scoring/asset, bỏ chữ ký→activity_log, bỏ duyệt/ngưỡng, giamdoc kiểm tra,
> admin quản trị mạng). Thiết kế chuẩn cho cencomOS Garage **v5.0**.
> **Mục tiêu**: Phần mềm quản lý xưởng sửa xe đầu kéo — chỉ 4 vai + theo dõi,
> bỏ rác ảo, nhưng **GIỮ báo giá** (thuộc quy trình 8 bước hồ sơ).

## 1. Điều chỉnh so với v1 (quan trọng)

| # | Yêu cầu người dùng | Xử lý |
|---|---|---|
| 1 | Báo giá cần thiết (nằm trong 8 bước) | ✅ **GIỮ** `baogia` (nhập tay) |
| 2 | Scoring ẩn toàn bộ | ⏸️ **DEFER** (phiên bản sau), không hiện UI |
| 3 | Asset ẩn toàn bộ | ⏸️ **DEFER** (phiên bản sau) |
| 4 | Chữ ký bỏ, thay activity_log | ✅ **BỎ** `nhanKy` → `activity_log` |
| 5 | Ẩn chat, preview, thăm khám, bot | ⏸️ **DEFER** (chưa cần) |
| 6 | Bỏ duyệt + ngưỡng duyệt (thủ công) | ✅ **BỎ** `scDuyet`/`dmDuyet`/threshold |

> **Ghi chú 8 bước hồ sơ**: Quy trình 8 bước CÓ bước báo giá → giữ `baogia`.
> Các bước "duyệt" trong 8 bước làm **THỦ CÔNG** (không có nút duyệt trên phần mềm
> ở phiên bản này).

## 2. Phạm vi (SCOPE) — 4 vai + admin

| Vai | Tiếng Việt | Nhiệm vụ | Quyền chính |
|---|---|---|---|
| `admin` | Quản trị mạng | Đảm bảo hệ thống chạy | **CHỈ XEM** (đánh giá) + tạo TEST (`is_test=1`, lưu 1 ngày). **KHÔNG** quyền nghiệp vụ |
| `giamdoc` | Giám đốc | **Quyền kiểm tra** | **XEM MỌI THỨ** (mọi module, mọi vai) + dashboard + activityFeed + report |
| `xuong` | Trưởng xưởng | **Lập/quản lý** phiếu sửa | Tạo SC, CV/VT, bắt đầu/sửa xong, từ chối |
| `ketoan` | Kế toán | **Làm hồ sơ** | Hồ sơ, báo giá, quyết toán |
| `kho` | Kho vật tư | **Đi mua đồ** | Vật tư, nhập/xuất, DM |

## 3. Luồng nghiệp vụ (LEAN, không duyệt phần mềm)

```
[Xe vào] ─▶ [xuong] tạo SC(de_xuat) + CV/VT
   │
   ├─ thiếu VT? ─▶ [kho] DM + nhập kho + xuất cho SC
   │
   ├─ [xuong] bắt đầu sửa ─▶ dang_sua ─▶ hoàn thành ─▶ da_hoan
   │                                    │
   ├─ [ketoan] nhập báo giá + hồ sơ ─▶ ho_so
   │                                    │
   └─ [ketoan] quyết toán ─▶ da_quyet
   
[Mọi bước] ─▶ activity_log ─▶ [giamdoc] dashboard + feed
```

## 4. Trạng thái đơn giản (KHÔNG duyệt phần mềm)

**SC**: `de_xuat → dang_sua → da_hoan → da_quyet` (+ `tu_choi`)
**DM**: `cho_duyet → da_nhap` (+ `tu_choi`) — `dmNhap` là nhập kho, không phải duyệt

## 5. Cấu trúc thư mục

| File | Nội dung |
|---|---|
| `README.md` | Tóm tắt này |
| `SCENARIOS.md` | 5 kịch bản Fully-Dressed (đã bỏ bước duyệt) |
| `DOMAIN.md` | Entity / Action / Rule (có baogia, defer list) |
| `SCHEMA.md` | 12 bảng PostgreSQL lean |
| `API.md` | ~32 RPC (không duyệt, có baogia) |
| `GAP_ANALYSIS.md` | Rác bỏ / defer + chức năng thiếu |
| `PLAN.md` | Kế hoạch chi tiết GĐ1–GĐ5 |
| `DIAGRAM.md` | Biểu đồ công việc + quan hệ vai + ma trận quyền |

## 6. Giả định (documented)
1. Không có vai thợ (sửa do Trưởng xưởng quản lý trạng thái).
2. Duyệt làm thủ công → phần mềm KHÔNG có nút duyệt/ngưỡng.
3. Báo giá nhập tay (không ảnh/OCR), thuộc hồ sơ 8 bước.
4. Theo dõi = `activity_log` duy nhất, Giám đốc xem feed + filter.
5. Giữ chuẩn chung: TS strict, Zod, RBAC, soft-delete, SQL param, ngày TEXT.
