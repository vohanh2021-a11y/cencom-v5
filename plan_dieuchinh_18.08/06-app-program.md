# 06 — CHƯƠNG TRÌNH ÁP DỤNG VÀO APP GARA

> **Nguyên lý cốt lõi:** *"Quy trình như thế nào, thì thao tác như thế đấy."*
> Mỗi bước trong Quy chế 206 phải là 1 thao tác rõ ràng trên app, theo đúng thứ tự,
> có người chịu trách nhiệm (role) và có GATE chặn nếu sai quy định.

## 1. Thiết kế hướng quy trình (Process-Driven UI)

Thay vì menu rời rạc, APP dùng **Expandable Card List** làm master (theo Shopify/Linear/Notion):
- Mỗi thẻ = 1 SC, hiển thị: xe, ngày, trách nhiệm, chip nhánh, chip trạng thái, chi phí, timeline ngắn gọn.
- Click mở rộng → xem **pipeline mini-graph** (8 bước progress + nested branch tree) + log hoạt động.
- Quy trình SC vẫn đi đúng 8 bước QC206 (như flowchart `05-flowchart.md`):
```
Kiểm tra (BẮT BUỘC mở SC) → Kết luận nhánh → Mua/Xuất VT → Sửa chữa
→ Thu hồi VT cũ (P2.2b) → Nghiệm thu+bàn giao (P2.2b/3) → Quyết toán → Thanh toán (P2.2a)
```
- Kanban giữ lại dưới dạng **toggle nhẹ** (4 cột lớn) khi cần tổng quan nhanh.

## 2. Ánh xạ thao tác chi tiết

| Bước QC206 | Thao tác trên APP | Màn hình | Role | Gate |
|---|---|---|---|---|
| 0 Kiểm tra (mở SC) | Kiểm tra TB, lưu biên bản kiểm tra | `/sc/[id]/kiem-tra` (mới) | xuong/tho | **điều kiện MỞ phiếu SC** |
| 1 Lập kế hoạch | Tạo Đề xuất sửa chữa | `/de-xuat/create` | laixe/pttb/xuong | — |
| 2 Xưởng xác nhận | Duyệt đề xuất | `/de-xuat` | xuong/pttb | cần `de_xuat.duy` |
| 3 Kiểm tu | Nhập bản kiểm tu (hạng mục hư hỏng) | `/sc/[id]/kiem-tu` (mới) | xuong | bắt buộc trước sửa |
| 4 Kế hoạch mua | Tạo đề nghị mua từ SC | `dmFromSC` | xuong/pttb | — |
| 5 Phê duyệt lớn | Duyệt SC/mua | `scTongDuyet`/`dmDecide` | giamdoc/quanly/pttb | `canApprove*` |
| 6 Sửa chữa | Thêm công việc/VTPT | `/sc/[id]` | xuong/tho | `sc.sua` |
| 7a Thu hồi cũ | Nhập kho VT cũ hỏng (cu_hong) | `/kho/nhap` (loại cu_hong) | khovattu | **bắt buộc nếu có thay thế** |
| 7b Nghiệm thu | Nghiệm thu + bàn giao + bảo hành | `/sc/[id]/nghiem-thu` | pttb+xuong | **chặn nếu thiếu VT cũ** |
| 8 Quyết toán | Quyết toán SC | `quyetToan` | ketoan | tự sinh cu_hong |
| 9 Thanh toán | Chi NCC | `phieuChiCreate` | ketoan | **chặn nếu thiếu HĐĐT** |

## 3. Đề xuất điều chỉnh UI cụ thể (cần build)

1. **Thêm role thực `pttb` + `laixe`** → Dashboard mỗi vai hiển thị task đúng trách nhiệm (PTTB thấy SC chờ duyệt; lái xe thấy Đề xuất của mình).
2. **Màn hình Kiểm tu** (`/sc/[id]/kiem-tu`): form nhập tình trạng hư hỏng, ảnh (không OCR, nhập thủ công), bổ sung hạng mục.
3. **`/kho/nhap` bổ sung option `loại nhập = Vật tư cũ/hỏng (cu_hong)`** + trường `ref_sc` để link SC → thoả mãn Mẫu 6.
4. **`/sc/[id]` bổ sung tab "Bàn giao & Bảo hành"** → in Mẫu 7 (biên bản 2 bên, có chữ ký).
5. **Thêm in "Bảng kê thay thế"** (Mẫu 8) từ `/sc/[id]` → liệt kê VTPT thay thế + VT cũ đã thu hồi.
6. **Gate trực quan:** nút "Nghiệm thu" disable + tooltip đỏ nếu SC có VTPT thay thế chưa thu hồi cũ; nút "Chi NCC" disable nếu công nợ thiếu HĐĐT.
7. **Báo cáo đối soát:** `/ke-toan/cong-no` có filter "Thiếu HĐĐT"; `/kho` có cảnh báo `ton_cu_hong` chưa lý.
8. **Dashboard master = Expandable Card List:** thẻ SC thu gọn, click mở rộng thấy pipeline mini-graph + 8 bước progress + log. **Kanban giữ lại dạng toggle nhẹ** (4 cột: `cho_kiem_tra` / `dang_sua` / `cho_thanhtoan` / `hoanthanh`).
9. **Timeline + Alert:** thẻ SC hiển thị timeline ngắn gọn (vd `01/05 KTT | 03/05 mua VT`); icon ⚠️ nếu thiếu HĐĐT (P2.2a) hoặc chưa thu hồi VT cũ (P2.2b).

## 4. Trải nghiệm theo vai trò (Role-based dashboards)

| Vai | Màn hình chính | Nút hành động nổi bật |
|---|---|---|
| Lái xe | Đề xuất của tôi, SC của tôi | + Tạo đề xuất |
| Tổ PTTB | SC chờ duyệt, kế hoạch mua | Duyệt SC, Duyệt mua, Kiểm soát giá |
| Xưởng / Thợ | Kiểm tra + Lập SC (nhánh sửa tại xưởng) | Bắt đầu kiểm tra, Lưu kết luận, Sửa chữa |
| BP Kho Vật tư (`khovattu`) | Nhập/Xuất, tồn kho, mua VT | + Nhập (mới/cũ hỏng), + Xuất, Mua theo SC (nhận quyền từ nhánh 2/3/4) |
| Kế toán | Quyết toán, công nợ, sổ cái | Quyết toán, Chi NCC (có gate) |
| GĐ/Quản lý | Duyệt lớn, báo cáo | Duyệt SC/mua vượt ngưỡng |

## 5. Nguyên tắc kỹ thuật (giữ nguyên kiến trúc v4)
- Mọi gate nằm ở **logic core** (`packages/core/src/*`), không chỉ ẩn UI (tránh lỗi bảo mật/IDOR).
- Mọi thay đổi qua transaction PG + `db.audit` + soft-delete.
- RPC contract `POST /api/rpc {fn,args}` giữ nguyên; bổ sung `fn` mới: `scKiemTuSave`, `scNghiemFull`, `bangKeThayThePrint`, `congNoChuaCoHoaDon`.
- RBAC: cập nhật `MATRIX` (`perm.ts`) + `reseed-perms.ts`.

## 6. Lộ trình áp dụng (tuần tự, có giám sát)
- Tuần 1: Bổ sung role `pttb`/`laixe` + MATRIX + test phân quyền.
- Tuần 2: Gate P2.2a (chặn TT thiếu HĐĐT) + báo cáo thiếu HĐĐT.
- Tuần 3: Gate P2.2b (bắt buộc thu hồi VT cũ) + UI `/kho/nhap` cu_hong + autoGenCuHong trong quyết toán.
- Tuần 4: Mẫu 6/7/8 (UI nhập + in biên bản/bảng kê) + wizard SC.
- Tuần 5: Conformance test (parity QC206) + UAT từng vai trò.

> ⚠️ **Lưu ý:** Chỉ là kế hoạch. Chưa sửa code. Sau khi user duyệt `07-ACTION-PLAN.md` mới triển khai từng bước có giám sát.
