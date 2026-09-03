# 04 — COMPLIANCE NGUYÊN TẮC 2 & 3 + KẾ HOẠCH LOGIC + RBAC

> Trạng thái: **PHÂN TÍCH + KẾ HOẠCH**. Chưa sửa code. Sau khi user duyệt (`07-ACTION-PLAN.md`) mới build.

## A. NGUYÊN TẮC 2 — KHÔNG THANH TOÁN THIẾU CHỨNG TỪ / KHÔNG THU HỒI VT CŨ

### A.1 Trạng thái hiện tại
- `phieuChiCreate` (`packages/core/src/ketoan.ts:170`):
  - ✅ Chặn vượt nợ (`so_tien > con_no`).
  - ✅ Chặn công nợ đã đóng.
  - ❌ **Không kiểm tra HĐĐT `vat_invoice`** → có thể chi tiền cho công nợ chưa có hóa đơn.
- Thu hồi VT cũ:
  - `autoGenCuHong` (`kho.ts:757`) sinh PXN `cu_hong` + `phieu_nhap_thanhly` khi SC có VTPT thay thế.
  - ❌ Chỉ là RPC thủ công (`kho.tao`), **không tự gọi** khi SC nghiệm thu/xong.
  - ❌ `scNghiem`/`quyetToan` không bắt buộc có thu hồi cũ.
- **Chi phí phụ nhánh 4:** `phieu_chi` CHƯA có trường `cp_ve_phuphi` (vé ô tô dịch vụ gửi, phụ phí xưởng ngoài) → chưa tách riêng để hạch toán đúng.

### A.2 Kế hoạch logic (sẽ implement ở GĐ build)

**A.2.1 Chặn thanh toán thiếu HĐĐT (P2.2a) — sửa `phieuChiCreate`:**
```ts
// Trước khi INSERT phiếu chi, với công nợ sinh từ phiếu nhập:
const cn = await tx.row('SELECT ref_type, ref_id FROM cong_no WHERE id=$1', cnId);
if (cn.ref_type === 'phieu_nhap') {
  const inv = await tx.row(
    "SELECT id FROM vat_invoice WHERE ref_phieu_nhap=$1 AND deleted_at=''",
    cn.ref_id
  );
  if (!inv) {
    return { ok:false, error:'Vi phạm QC206 Điều 2: công nợ chưa có HĐĐT đầu vào, không được thanh toán.' };
  }
}
```
- Thêm báo cáo `congNoChuaCoHoaDon` (công nợ phai_tra thiếu `vat_invoice`) để Kế toán/PTTB đối soát.

**A.2.2 Bắt buộc thu hồi VT cũ (P2.2b):**
- Thêm cờ phân biệt VTPT thay thế: xác nhận `sc_vattu` có trường `la_thay_the` (hoặc dùng `tt` đã xuất). Nếu chưa có → migrate thêm cột.
- Sửa `scNghiem` (nghiệm thu): chặn nếu SC có `sc_vattu.la_thay_the=1` mà chưa có `phieu_nhap loai='cu_hong' ref_sc=scId`.
  ```ts
  const thieu = await tx.row(
    "SELECT 1 FROM sc_vattu s WHERE s.sc_id=$1 AND s.la_thay_the=1 AND s.deleted_at='' " +
    "AND NOT EXISTS(SELECT 1 FROM phieu_nhap p WHERE p.loai_nhap='cu_hong' AND p.ref_sc=$1 AND p.deleted_at='')",
    scId
  );
  if (thieu) return { ok:false, error:'Vi phạm QC206 Điều 2: chưa thu hồi vật tư cũ/hỏng nhập kho.' };
  ```
- Tự động hoá: gọi `autoGenCuHong` BÊN TRONG `scFinish`/`quyetToan` (transaction) thay vì chờ RPC thủ công.
  - Link thanh toán: cảnh báo (hoặc chặn) nếu công nợ NCC liên quan SC chưa thu hồi VT cũ.

**A.2.3 Chi phí phụ & không sổ sách (nhánh 4, 3b gửi kiểm tra):**
- Thêm cột `cp_ve_phuphi` (numeric) vào `phieu_chi` — cộng vào tổng CP trước khi quyết toán.
- Quy tắc hạch toán (theo thực tế công ty):
  - Có HĐĐT/VAT → `Nợ 138 (CP vận chuyển) / Có 331` (hoặc `Có 112` nếu TM).
  - Không có sổ sách (vé ô tô dịch vụ gửi, tiền mặt trả công ngoài) → gộp `Nợ 642 / Có 112 (TM)` hoặc `/Có 331`, ghi `co_vat=false, loai_chung_tu='khac'`.
- **Tam ứng tiền mặt BP mua: HOÃN sang giai đoạn 2** (chưa có quy trình bù trừ). Giai đoạn build hiện tại dùng drop-list `hinh_thuc=ghi_no` khi không có sổ sách.

### A.3 Tiêu chí giám sát (Done when)
- [ ] `phieuChiCreate` trả lỗi rõ khi thiếu `vat_invoice` (có test `ketoan-gd3` bổ sung).
- [ ] `scNghiem` trả lỗi khi SC có VTPT thay thế chưa thu hồi cũ (có test `kho`/`asset`).
- [ ] `quyetToan` tự gọi `autoGenCuHong` thành công trong transaction.
  - [ ] Báo cáo "công nợ thiếu HĐĐT" có trên `/ke-toan/cong-no`.
  - [ ] `phieu_chi` có `cp_ve_phuphi`; chi phí không sổ sách gộp 642 đúng `co_vat`/`loai_chung_tu`.

## B. NGUYÊN TẮC 3 — SỬA CHỮA CÓ KẾ HOẠCH/LỆNH + NGHIỆM THU/BÀN GIAO

### B.1 Trạng thái hiện tại
- ✅ `de_xuat` → `deXuatApprove` → `deXuatToSC` (có lệnh).
- ⚠️ `scNghiem` có nhưng "bàn giao + bảo hành" chưa thành biên bản in (xem `03-audit-8-mau.md` mẫu 7).

### B.2 Kế hoạch
- Bổ sung trường `sc.ban_giao_tai` (ngày bàn giao), `sc.bao_hanh_den` (hạn bảo hành), `sc.nguoi_nghiem_thu` (PTTB).
- `scNghiem` yêu cầu nhập người nghiệm thu (bắt buộc thuộc vai PTTB/Xưởng) + ngày.
- In `Mẫu 7` (biên bản nghiệm thu + bàn giao + bảo hành) từ `/sc/[id]`.

## C. MA TRẬN RBAC THEO ĐÚNG PHÂN VAI QC206

### C.1 Hiện tại (`perm.ts` MATRIX)
| Role | Module/feature chính |
|---|---|
| `xuong` | sc(tao/sua/kehoach), de_xuat(tao/sua), kho(xem), asset(xem) |
| `khovattu` | kho(tao/sua/xuat), mua(xem/tao), sc(xem) |
| `ketoan` | ke_toan(*), mua(tao/duy), asset(xem/quyet), sc(xem/tao/kehoach) |
| `quanly` | sc(duy/kehoach), de_xuat(duy), ke_toan(xem/tao/vat/chi/baocao) |
| `giamdoc` | sc(duy/kehoach), mua(duy), ke_toan(*), de_xuat(duy) |
| `tho` | sc(xem/tao/sua), gd2(*) |
| `admin` | all |

### C.2 Khoảng trống vs QC206
- ❌ **Thiếu `Tổ PTTB`** — QC206 giao PTTB: giám sát sửa chữa + quyết định mua chất lượng VTPT.
- ⚠️ **`laixe` chỉ preview** (`preview.ts`) — không có thực trong `auth.ts`/`perm.ts`.

### C.3 Đề xuất bổ sung (sẽ thêm vào MATRIX)
**Role mới `pttb` (Tổ PTTB):**
```
pttb: {
  sc: ['xem','duy','kehoach'],      // giám sát + duyệt kế hoạch
  mua: ['xem','duy','tao'],         // quyết định mua chất lượng VTPT
  de_xuat: ['xem','duy'],
  kho: ['xem'], asset: ['xem'], xe: ['xem'],
  report: ['xem'], chat: ['xem','tao','sua'],
  xuong: ['xem'], gd2: ['xem'], search: ['xem'], ke_toan: ['xem']
}
```
- Sửa `canApproveMua`: thêm `pttb` duyệt mọi mức (hoặc theo ngưỡng).
- Sửa `canApproveSC`: thêm `pttb` (giám sát).

**Role `laixe` (thực):**
```
laixe: {
  de_xuat: ['xem','tao','sua'],     // đề xuất sửa chữa
  xe: ['xem'], sc: ['xem'], chat: ['xem','tao'],
  gd2: ['xem'], search: ['xem']
}
```
- Thêm `laixe` vào `ROLES` (`perm.ts:10`) + `ROLES_LOCAL` (`auth.ts:180`).
- Gộp `preview.ts PREVIEW_ROLES` → dùng `ROLES` thật.

### C.4 Tiêu chí giám sát
- [ ] `ROLES` chứa `pttb`, `laixe`; `reseed-perms.ts` seed đúng MATRIX.
- [ ] `canApproveMua`/`canApproveSC` nhận `pttb`.
- [ ] Test `perm.test.ts` cover `pttb` (sc.duy, mua.duy) và `laixe` (de_xuat.tao, sc.xem).
- [ ] UI `/perm` hiển thị 2 role mới; `/users` tạo user role mới.

## D. Rủi ro khi build
- **Schema:** `sc_vattu.la_thay_the` có thể chưa tồn tại → cần migration + cập nhật `scVtAdd`.
- **False-block:** chặn TT thiếu HĐĐT có thể ảnh hưởng phiếu chi nội bộ (không phải NCC). Cần phân biệt `cong_no.ref_type` (chỉ block `phieu_nhap`).
- **Tương thích ngược:** NCC hiện là text tự do (`phieu_nhap.nha_cc`), chưa master → HĐĐT link qua `ref_phieu_nhap` vẫn ok nhưng báo cáo NCC yếu.
