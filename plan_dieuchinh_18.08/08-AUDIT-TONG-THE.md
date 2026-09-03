# 08 — AUDIT TỔNG THỂ TRƯỚC KHI BUILD

> Mục đích: tổng hợp các GAP còn thiếu trong code/schema thực tế so với plan 18.08 v2,
> để làm checkpoint trước khi bắt đầu build từng giai đoạn G1→G7.

## 1. GAP VỀ ROLE / RBAC
- [ ] `ROLES` (`packages/core/src/perm.ts:10`) chưa có `pttb`, `laixe`, `khovattu` (hiện là `khoa`).
- [ ] `ROLES_LOCAL` (`packages/core/src/auth.ts:180`) chưa có 3 role mới.
- [ ] `MATRIX` chưa cập nhật `khovattu` (đổi từ `khoa`) + `pttb`/`laixe`.
- [ ] `canApproveMua`/`canApproveSC` (`perm.ts:130`) chưa nhận `pttb`.
- [ ] `preview.ts PREVIEW_ROLES` chỉ có `laixe` (preview) → cần gộp `ROLES` thật.

## 2. GAP VỀ SCHEMA
- [ ] `phieu_chi` chưa có cột `cp_ve_phuphi` (numeric) — cần migration.
- [ ] `phieu_chi` chưa có `hinh_thuc` drop-list đầy đủ (`ck`/`tm`/`tam_ung`/`ghi_no`/`khac`) — cần xác nhận.
- [ ] `sc` chưa có `ket_luan` (json: nhanh, danh_sach_vt_thay, loai_huu_hai...) và `nhanh` (1/2/3/4.x).
- [ ] `sc_vattu` chưa có `la_thay_the` (cờ VTPT thay thế) — cần migration.
- [ ] `sc` chưa có `ban_giao_tai`, `bao_hanh_den`, `nguoi_nghiem_thu`.
- [ ] Master NCC (`khach_hang.la_ncc`) chưa có → báo cáo HĐĐT/NCC yếu (riêng GĐ).

## 3. GAP VỀ LOGIC COMPLIANCE
- [ ] `phieuChiCreate` (`ketoan.ts:170`) chưa check `vat_invoice` (P2.2a).
- [ ] `autoGenCuHong` (`kho.ts:757`) không tự gọi khi SC xong (P2.2b).
- [ ] `scNghiem`/`quyetToan` không bắt buộc thu hồi VT cũ.
- [ ] Chưa có RPC `scKiemTraSave`, `scSetNhanh`, `congNoChuaCoHoaDon`, `bangKeThayThePrint`.

## 4. GAP VỀ UI / UX
- [ ] `/sc/kanban` hiện là Kanban → cần transform thành Expandable Card List (G7.1).
- [ ] Chưa có card detail pipeline mini-graph + 8 bước progress.
- [ ] Chưa có Kanban toggle nhẹ.
- [ ] `/kho/nhap` chưa expose `loai_nhap='cu_hong'` (Mẫu 6).
- [ ] `/sc/[id]` chưa có tab "Bàn giao & Bảo hành" (Mẫu 7) + "Bảng kê thay thế" (Mẫu 8).
- [ ] Chưa có màn hình Kiểm tra (Mẫu 2) độc lập + gate "Kiểm tra mới mở SC".

## 5. GAP VỀ XUẤT FILE
- [ ] Chưa có handler export xlsx 9 tab (theo `03-audit-8-mau.md`).
- [ ] Chưa có in PDF A5/A4 (theo quyết định 18.08 v2).

## 6. RỦI RO CẦN LƯU Ý
1. **False-block SC cũ:** SC trước 18.08 chưa có `la_thay_the` → migration đánh `0` mặc định.
2. **NCC text tự do:** HĐĐT link qua `ref_phieu_nhap` vẫn ok nhưng báo cáo yếu → cần master NCC.
3. **Tương thích ngược:** P2.2a chỉ block `cong_no.ref_type='phieu_nhap'` (không block chi nội bộ).
4. **Tam ứng:** hoãn GĐ2, dùng `ghi_no` drop-list hiện tại.
5. **Rollback:** mọi build qua transaction + audit; `reseed-perms.ts` khôi phục MATRIX cũ nếu lỗi.

## 7. THỨ TỰ BUILD ĐỀ XUẤT (có giám sát)
- **G1** RBAC (role mới) → **G2** P2.2a (HĐĐT) → **G3** P2.2b + `cp_ve_phuphi` (thu hồi cũ) → **G4** Mẫu 7/8/2 → **G5** Wizard + dashboard → **G7** UI card list + export → **G6** Conformance + UAT.

> ⚠️ **Lưu ý hệ thống sản xuất (Production Check):**
> - **Còn thiếu gì?** Toàn bộ GAP §1–§5 ở trên chưa có trong code.
> - **Rủi ro ở đâu?** Role sai → login kẹt; gate sai → kẹt nghiệp vụ; schema thiếu → migrate lỗi.
> - **Đã chạy kiểm thử chưa?** Chưa (mới cập nhật actually đây là audit tài liệu, chưa sửa code).
> - **Đề xuất tiếp?** User duyệt `07-ACTION-PLAN.md` → AI build tuần tự G1→G7, mỗi bước checkpoint + báo cáo.
