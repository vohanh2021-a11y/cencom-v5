# 03 — AUDIT 8 MẪU HỒ SƠ ↔ UI v4

> Mỗi mẫu đối chiếu với route UI (`apps/web/app/(app)/*`) và RPC tương ứng.
> Kết luận: ✅ Đã có / ⚠️ Một phần (thiếu trường hoặc in) / ❌ Thiếu.

## Mẫu 1 — Kế hoạch sửa chữa
- **Mục đích:** Tổ PTTB + phòng Xe máy lập kế hoạch SC từ đề xuất lái xe + kiểm tra thực tế.
- **UI v4:** `/de-xuat` (Đề xuất sửa chữa), `/de-xuat/create`, `/sc`, `/sc/create`.
- **RPC:** `deXuatCreate` (de_xuat.tao), `deXuatApprove` (de_xuat.duy), `deXuatToSC`.
- **Kết luận:** ✅ Đã có (Đề xuất ≈ kế hoạch SC). Còn thiếu: trường "kiểm tra thực tế hư hỏng" gắn với lái xe.

## Mẫu 2 — Bản kiểm tu sửa chữa
- **Mục đích:** Kiểm tu tình trạng hư hỏng, bổ sung hạng mục (trách nhiệm lái xe).
- **UI v4:** `/sc/[id]` (phiếu SC có `scWork*`, `scVt*`, trạng thái).
- **RPC:** `scStart`, `scWorkAdd`, `scVtAdd`.
- **Kết luận:** ⚠️ Một phần. Có phiếu SC nhưng **chưa có biểu mẫu "Bản kiểm tu" riêng** (hiện là danh sách công việc/vật tư). Cần màn hình/fields kiểm tu độc lập.

## Mẫu 3 — Phiếu mua vật tư (báo giá, hóa đơn)
- **Mục đích:** Báo giá NCC + HĐĐT đầu vào.
- **UI v4:** `/baogia`, `/de-xuat` (mua `dm*`), `/ke-toan/nhap-vat` (HĐĐT).
- **RPC:** `baogia*`, `dmCreate`/`dmDecide` (mua), `vatInvoiceSave` (ke_toan.vat).
- **Kết luận:** ✅ Đã có (báo giá + quyết định mua + HĐĐT).

## Mẫu 4 — Phiếu nhập kho vật tư
- **Mục đích:** Nhập VT mới vào kho (có HĐĐT).
- **UI v4:** `/kho/nhap`.
- **RPC:** `phNhapCreate` (kho.tao) — hỗ trợ `loai_nhap='moi'`, `vat`, `cong_no`.
- **Kết luận:** ✅ Đã có.

## Mẫu 5 — Phiếu xuất kho vật tư
- **Mục đích:** Xuất VT cho SC (giá vốn) hoặc xuất khác.
- **UI v4:** `/kho/xuat`.
- **RPC:** `phXuatCreate` (kho.xuat) — `loai_xuat='dung'|'cu_hong'`.
- **Kết luận:** ✅ Đã có (xuất thường). Xuất `cu_hong` ở đây là "thanh lý hư hỏng" (xuất khỏi kho hư), không phải nhập VT cũ.

## Mẫu 6 — Phiếu nhập kho vật tư cũ hỏng ⚠️ ĐẶC BIỆT
- **Mục đích:** Thu hồi VTPT cũ/hỏng thay thế → nhập vào kho hư hỏng (bắt buộc theo P2.2b).
- **Logic v4:** `phNhapCreate` hỗ trợ `loai_nhap='cu_hong'` → cộng `ton_cu_hong` + ghi `phieu_nhap_thanhly` (ketoan.ts/kho.ts). `autoGenCuHong` tự sinh khi SC có VTPT thay thế.
- **UI v4:** `/kho/nhap` — **chưa expose option `loai_nhap='cu_hong'`** (grep chỉ thấy `cu_hong` ở `/kho/xuat` dạng "Thanh lý hư hỏng" xuất). `autoGenCuHong` là RPC thủ công, không tự gọi.
- **Kết luận:** ❌ **THIẾU UI nhập thủ công mẫu 6**. Hiện chỉ tự động từ SC (nếu dev gọi), không có màn hình cho thủ kho nhập VT cũ hỏng ngoài luồng SC. Cần bổ sung option `loai_nhap='cu_hong'` trên `/kho/nhap` + bắt buộc khi SC có VTPT thay thế.

## Mẫu 7 — Biên bản nghiệm thu sửa chữa & bàn giao phương tiện
- **Mục đích:** Nghiệm thu PTTB + bàn giao xe + bảo hành (văn bản, có xác nhận 2 bên).
- **UI v4:** `/sc/[id]` → `scNghiem` (sc.duy) + snapshot `bien_ban_nghiem`.
- **RPC:** `scNghiem`, `scTongDuyet`.
- **Kết luận:** ⚠️ Một phần. Có nghiệm thu + snapshot, nhưng **chưa có biểu mẫu in "Biên bản bàn giao + bảo hành"** có chữ ký 2 bên (PTTB ↔ Xưởng).

## Mẫu 8 — Bảng kê chi tiết nội dung thay thế sửa chữa ⚠️ ĐẶC BIỆT
- **Mục đích:** Liệt kê chi tiết VTPT/CP thay thế trong đợt sửa chữa (phục vụ quyết toán + thu hồi cũ).
- **Logic v4:** `sc_vattu` có trường `tt`, `gia_ngay`, `la_sua_ngoai`; `lich_sua` tổng chi phí (`asset.ts`).
- **UI v4:** `/sc/[id]` liệt kê vật tư, nhưng **chưa có báo cáo in "Bảng kê thay thế"** chuyên biệt (không thấy `thay thế`/`bảng kê` trong apps/web).
- **Kết luận:** ❌ **THIẾU báo cáo in mẫu 8**. Cần thêm màn hình/in `sc/[id]/bang-ke-thay-the` (hoặc phần in trong `sc/[id]`).

## BẢNG TỔNG HỢP
| Mẫu | UI v4 | Kết luận | Ưu tiên build |
|---|---|---|---|
| 1 Kế hoạch SC | /de-xuat, /sc | ✅ | — |
| 2 Bản kiểm tu | /sc/[id] | ⚠️ thiếu form riêng | Trung bình |
| 3 Phiếu mua VT | /baogia, /ke-toan | ✅ | — |
| 4 Phiếu nhập | /kho/nhap | ✅ | — |
| 5 Phiếu xuất | /kho/xuat | ✅ | — |
| 6 Nhập VT cũ hỏng | (thiếu UI) | ❌ | **Cao** (P2.2b) |
| 7 Nghiệm thu+bàn giao | /sc/[id] | ⚠️ thiếu in | Cao |
| 8 Bảng kê thay thế | (thiếu) | ❌ | **Cao** |

## XUẤT FILE (BÁO CÁO)
- **Ưu tiên xlsx nhiều tab** — mỗi mẫu/in ấn = 1 tab, thuận tiện kế toán đối soát/lọc:
  | Tab | Nội dung | Gắn với |
  |---|---|---|
  | 01_KiemTra | Bản kiểm tra (Mẫu 1/2) | SC |
  | 02_DanhSachVT | VT thay & VT cũ thu hồi (Mẫu 2/8) | sc_vattu + phieu_nhap_thanhly |
  | 03_MuaVT | Phiếu mua (3a/3b/3c) | de_nghy_mua + vat_invoice |
  | 04_NhapKho | Phiếu nhập (Mẫu 4/6) | phieu_nhap |
  | 05_XuatKho | Phiếu xuất (Mẫu 5) | phieu_xuat |
  | 06_PhuPhi | Chi phí VE/PHỤ PHÍ nhánh 4 (`cp_ve_phuphi`) | phieu_chi + sc |
  | 07_QuyetToan | Tổng hợp chi phí (152/642/622) | asset.lich_sua + ledger |
  | 08_ThanhToan | Công nợ + phiếu chi (331/112) | cong_no + phieu_chi |
  | 09_CongTy | So sánh: kho vs sổ cái, công nợ vs 331 | reconcile |
- **PDF (dự phòng):** in HTML-print — A5 cho biên bản ngắn (Mẫu 1/2/7), A4 cho bảng kê dài (Mẫu 8).

> ⚠️ **Lưu ý:** Mẫu 6 & 8 là khoảng trống trực tiếp vi phạm Quy chế (thu hồi VT cũ bắt buộc + bảng kê phục vụ quyết toán). Cần ưu tiên build cùng với compliance P2.2b.
