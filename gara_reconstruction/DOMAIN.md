# DOMAIN — Entity / Action / Business Rule (v5.0, đã điều chỉnh)

## 1. ENTITY (bảng CSDL)

### Hiện hữu (tạo trong phiên bản này)
| Entity | Mô tả |
|---|---|
| `users` | User + vai (admin/giamdoc/xuong/ketoan/kho) |
| `xe` | Xe đầu kéo |
| `sc` | Phiếu sửa chữa (core) |
| `sc_congviec` | Công việc sửa |
| `sc_vattu` | Vật tư dùng trong phiếu |
| `vattu` | Vật tư (danh mục + tồn) |
| `nhap_xuat` | Sổ nhập/xuất kho |
| `dm` | Đề nghị mua |
| `dm_chitiet` | Chi tiết DM |
| `baogia` | **Báo giá NCC (nhập tay)** — GIỮ (8 bước) |
| `baogia_chitiet` | Chi tiết báo giá |
| `ho_so` | Hồ sơ kế toán / quyết toán |
| `activity_log` | Nhật ký toàn bộ hoạt động xưởng |
| `config` | Counter id |

### ẨN / DEFER (phiên bản sau — KHÔNG tạo bảng, KHÔNG hiện UI)
| Entity | Lý do |
|---|---|
| `scoring` (điểm A-E) | Chưa cần, defer |
| `asset` (khấu hao GTTV) | Chưa cần, defer |
| `chat` / `CencomBot` | Chưa cần |
| `preview` (xem thử vai) | Chưa cần |
| `tk` (thăm khám lái xe) | Chưa có vai lái xe |
| `nhanKy` (8 chữ ký) | **BỎ hẳn** → thay activity_log |

## 2. ACTION / CONTROLLER (hàm RPC)

| Action | Gắn UC | Quyền (ghi) |
|---|---|---|
| `login`/`logout`/`changePassword`/`currentUser`/`appInfo` | auth | mọi role |
| `xeList`/`xeGet` | UC1 | xem: xuong/kho/ketoan/**giamdoc**/**admin** |
| `xeCreate` | UC1 | **admin** (test, `is_test=1`) |
| `scList`/`scGet` | UC1 | xem: xuong/ketoan/kho/**giamdoc**/**admin** |
| `scCreate` | UC1 | **xuong** (thật) · **admin** (test) |
| `scAddCongViec`/`scAddVatTu` | UC1 | xuong (khi de_xuat) |
| `scBatDauSua` | UC1 | xuong |
| `scHoanThanh` | UC1 | xuong (CV đều hoan) |
| `scTuChoi` | UC1 | xuong |
| `scQuyetToan` | UC3 | ketoan |
| `vattuList`/`vattuGet` | UC2 | xem: mọi (xuong/ketoan/kho/giamdoc/admin) |
| `vattuCreate` | UC2 | **kho** (thật) · **admin** (test) |
| `nhapKho`/`xuatKho` | UC2 | **kho** · **admin**(test) |
| `dmCreate`/`dmNhap` | UC2 | **kho** · **admin**(test) |
| `baogiaList`/`baogiaGet` | UC3 | xem: mọi (ketoan q.ly, giamdoc/admin xem) |
| `baogiaSave` | UC3 | **ketoan** (thật) · **admin**(test) |
| `hoSoSave`/`hoSoGet` | UC3 | **ketoan** (thật) · **admin**(test) / xem: giamdoc/xuong/kho |
| `dashboard` | UC4 | **giamdoc**/**admin** (quan sát) · xuong (xưởng) |
| `activityFeed` | UC4/5 | **giamdoc**/**admin** (toàn bộ) |
| `reportSummary` | UC4 | **giamdoc**/**admin** |

> **MÔ HÌNH QUYỀN v3**:
> - `giamdoc` = **QUYỀN KIỂM TRA**: XEM MỌI THỨ (mọi module, mọi vai) + dashboard + activityFeed + report. KHÔNG tạo/sửa.
> - `admin` = **QUẢN TRỊ MẠNG**: XEM để đánh giá hệ thống + được tạo MỚI ở chế độ TEST (`is_test=1`, tự xoá sau 1 ngày). KHÔNG nắm quyền nghiệp vụ thật.
> - `xuong`/`ketoan`/`kho` = quyền ghi module nghiệp vụ của mình.
>
> **ĐÃ BỎ**: `scDuyet`, `dmDuyet`, `canApproveSC`, `canApproveMua`, ngưỡng 5tr.
> Duyệt làm thủ công → không có hàm duyệt.

## 3. BUSINESS RULES

### 3.1 Tính tiền SC
- `tong_cong = Σ(sc_congviec.so_luong × don_gia)`
- `tong_vt = Σ(sc_vattu.so_luong × (gd_tt>0 ? gd_tt : gd_dk))`
- `tong = tong_cong + tong_vt`

### 3.2 State machine SC (KHÔNG duyệt)
```
de_xuat → dang_sua → da_hoan → da_quyet
             \→ tu_choi
```
- `scBatDauSua`: `de_xuat`→`dang_sua`
- `scHoanThanh`: `dang_sua`→`da_hoan` (mọi CV `tt='hoan'`)
- `scQuyetToan`: `da_hoan`→`da_quyet` (ketoan, 1 lần)
- Từ `da_hoan`: khoá sửa dòng

### 3.3 Kho
- Nhập: tăng `vattu.ton`, cập nhật `vattu.gia`
- Xuất: giảm `ton`; **thiếu tồn → fail CẢ phiếu**
- `vattu.ton < ton_min` → dashboard báo Giám đốc

### 3.4 DM (KHÔNG duyệt)
```
cho_duyet → da_nhap (+ tu_choi)
```
- `dmNhap`: từ `cho_duyet` → nhập kho → `da_nhap` + log (đây là NHẬP, không phải duyệt)

### 3.5 Báo giá (GIỮ — 8 bước)
- `baogia` gắn với `sc_id`, nhập tay items (NCC, tên, số lượng, đơn giá)
- Thuộc hồ sơ kế toán (`ho_so` + `baogia` = 8 bước)

### 3.6 Activity log (THEO DÕI TOÀN BỘ)
- Mọi hành động ghi → 1 dòng `activity_log`
- Giám đốc lọc: role / xe / ngày / loại hành động
- Chỉ append, không xoá

## 4. VALIDATION
- Enum whitelist: `trang_thai` SC, `loai` nhap_xuat, `loai_xu_ly` CV, `role` users
- Số > 0 hợp lệ; ID `PREFIX-000001`; ngày TEXT `YYYY-MM-DD`
- Zod validate mọi RPC
