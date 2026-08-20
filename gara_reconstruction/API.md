# API — RPC Contract (LEAN v5.0, ~32 RPC)

> `POST /api/rpc` `{"fn","args"}` → `{ok,result|error}`. 401/403/404/400.
> Default-deny, Zod validate. **KHÔNG có hàm duyệt/ngưỡng**.
> **v3 quyền**: `giamdoc` = XEM MỌI THỨ (quyền kiểm tra); `admin` = XEM + tạo TEST
> (`is_test=1`, tự xoá sau 1 ngày). Xem `DIAGRAM.md` ma trận quyền.

## 1. AUTH
| fn | args | quyền |
|---|---|---|
| `login` | (user,pass) | public |
| `logout` | () | mọi |
| `changePassword` | (old,new) | chủ |
| `currentUser` | () | mọi |
| `appInfo` | () | mọi |

## 2. XE
| fn | args | quyền |
|---|---|---|
| `xeList` | () | xem: xuong/kho/ketoan/**giamdoc**/**admin** |
| `xeGet` | (id) | xem: như trên |
| `xeCreate` | (bien_so,chu_xe,nam_sx,nguyen_gia) | **admin** (test, `is_test=1`) |

## 3. SC — Trưởng xưởng (KHÔNG duyệt)
| fn | args | quyền |
|---|---|---|
| `scList` | (filter?) | xem: xuong/ketoan/kho/**giamdoc**/**admin** |
| `scGet` | (id) | xem: như trên |
| `scCreate` | (xe_id,ngay) | **xuong** (thật) · **admin** (test) |
| `scAddCongViec` | (sc_id,mo_ta,nguyen_nhan,loai_xu_ly,so_luong,don_gia) | xuong |
| `scAddVatTu` | (sc_id,vattu_id,so_luong) | xuong |
| `scBatDauSua` | (sc_id) | xuong |
| `scHoanThanh` | (sc_id) | xuong |
| `scTuChoi` | (sc_id,ly_do) | xuong |
| `scQuyetToan` | (sc_id) | ketoan |

## 4. KHO — Kho vật tư (KHÔNG duyệt)
| fn | args | quyền |
|---|---|---|
| `vattuList` | () | xem: mọi (xuong/ketoan/kho/giamdoc/admin) |
| `vattuGet` | (id) | xem: mọi |
| `vattuCreate` | (ten,don_vi,gia,ton_min) | **kho** (thật) · **admin** (test) |
| `nhapKho` | (vattu_id,so_luong,don_gia,ngay,ly_do) | **kho** · **admin**(test) |
| `xuatKho` | (vattu_id,so_luong,sc_id?,ly_do) | **kho** · **admin**(test) |
| `dmCreate` | (sc_id?,items[],ngay) | **kho** · **admin**(test) |
| `dmNhap` | (dm_id) | **kho** · **admin**(test) (nhập kho, không phải duyệt) |

## 5. BÁO GIÁ — Kế toán (GIỮ, 8 bước)
| fn | args | quyền |
|---|---|---|
| `baogiaList` | () | xem: mọi (ketoan q.ly, giamdoc/admin xem) |
| `baogiaGet` | (id) | xem: mọi |
| `baogiaSave` | (sc_id,ncc,ngay,items[]) | **ketoan** (thật) · **admin**(test) |

## 6. HỒ SƠ — Kế toán
| fn | args | quyền |
|---|---|---|
| `hoSoGet` | (sc_id) | xem: giamdoc/xuong/kho/ketoan/admin |
| `hoSoSave` | (sc_id,so_chung_tu,ngay,ghi_chu) | **ketoan** (thật) · **admin**(test) |

## 7. QUAN SÁT — Giám đốc / Admin
| fn | args | quyền |
|---|---|---|
| `dashboard` | () | **giamdoc**/**admin** (quan sát) · xuong (dashboard xưởng) |
| `activityFeed` | (filter?:role/xe/ngay/loai) | **giamdoc**/**admin** (toàn bộ) |
| `reportSummary` | (tu_ngay,den_ngay) | **giamdoc**/**admin** (chỉ tính `is_test=0`) |

## ĐÃ BỎ
- `scDuyet`, `dmDuyet`, `canApprove*`, ngưỡng 5tr
- `scoring*`, `asset*`, `chat*`, `preview*`, `tk*`, `nhanKy*` → defer/không có
- Tổng ~32 RPC (từ ~80 bản cũ)
