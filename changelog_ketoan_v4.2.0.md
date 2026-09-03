# Changelog — Kế toán VAS (module kế toán nội bộ) v4.2.0

> **Phiên bản:** v4.2.0 (module kế toán là subsystem lớn → bump 4.2, không chỉ 4.0.2)
> **Ngày:** 2026-08-16
> **Tác giả:** Gatekeeper (AI build agent)
> **Phạm vi GĐ1 (đã làm):** Schema sổ cái kép + hệ thống tài khoản (CoA) + handler `ledgerPost`/`ledgerList` + phân quyền `ke_toan` + migration live DB + unit test.

## Quyết định scope (từ người dùng)
- **Mô hình:** xe đầu kéo nội bộ → CHỈ chi phí. KHÔNG doanh thu, KHÔNG AR khách, KHÔNG HĐĐT đầu ra.
- **Kế toán:** đầy đủ VAS (sổ cái kép, CoA, chứng từ, khóa kỳ, CĐKT, báo cáo chi phí).
- **Thuế:** chỉ VAT đầu vào (133 được khấu trừ từ HĐĐT NCC).
- **COGS:** cấu hình 2 loại (`binh_quan` mặc định / `fifo` tùy chọn), mặc định **bình quân gia quyền**.

> Lưu ý: `tk` trong mã nguồn = "Thăm khám sửa chữa" (từ lái xe), KHÔNG phải kế toán. Kế toán cost-side đã có ở `asset/kho/sc`, nay bổ sung thành VAS đầy đủ.

## GĐ1 — Đã hoàn thành
1. **Schema (`packages/db/src/accounting.sql` + `schema.sql`)**
   - `tai_khoan` (CoA 21 tk: 111,112,133,152,153,154,156,211,214,241,331,3331,334,421,621,622,627,641,642,911,632 — bỏ 131/511/711).
   - `chung_tu`, `ledger` (ràng buộc `chk_ledger_side`: mỗi dòng đúng 1 bên Nợ/Có > 0; `ct_id` FK → chứng từ).
   - `ky_ke_toan` (khóa kỳ), `ke_toan_setting` (`cogs_method`), `ton_lot` (FIFO), `cong_no` (công nợ), `vat_invoice` (VAT đầu vào).
   - Tiền `NUMERIC(14,2)` cho bảng mới (bảng cũ giữ `REAL` tương thích ngược).
2. **Seed CoA (`packages/db/src/coa_seed.sql`)** — idempotent.
3. **Module `packages/core/src/ledger.ts`**
   - `ledgerPost`: kiểm tra quyền `ke_toan.tao`; validate (≥2 bút toán, đúng 1 bên, tổng Nợ=Có, tài khoản tồn tại, không trong kỳ đóng); ghi trong 1 transaction (nextId + INSERT + audit). Trả `{ok, ct_id}` hoặc `{ok:false, error}` (không throw).
   - `ledgerList`: tra cứu có phân quyền `ke_toan.xem`.
   - `postInner(tx, arg, me)`: dùng cho tích hợp GĐ2 (kho/SC ghi bút toán trong transaction của họ).
   - `getCogsMethod`: đọc `cogs_method`.
4. **Contract (`packages/contract/src/schemas.ts`)** — `ledgerPost`, `ledgerList` Zod + đăng ký `RPC_SCHEMAS`.
5. **Phân quyền (`packages/core/src/perm.ts`)** — thêm `ke_toan` vào `MODULES` + `MATRIX` (ketoan: xem/tao/duy/quyet; quanly/giamdoc: xem/tao/quyet[/duy]).
6. **RPC dispatch (`apps/web/lib/rpc-dispatch.ts`)** — `RPC_META['ledgerPost']=['ke_toan','tao']`, `ledgerList` xem.
7. **Migration (`scripts/apply-ledger-schema.mjs`)** — áp dụng live DB (54322), idempotent.
 8. **Test (`packages/core/tests/ledger.test.ts`)** — TDD: cân bằng, từ chối lệch, từ chối tài khoản không tồn tại, từ chối thiếu quyền, ledgerList, COGS mặc định.

## GĐ2 — Liên thông Kho / SC / Tài sản ↔ Kế toán (ĐÃ XONG)
1. **Seed CoA vào `seedAll` (`packages/db/src/seed.ts`)** — thêm `seedCoA` đọc `coa_seed.sql`, gọi sau `seedVattu`. Đảm bảo mọi test/fixture có hệ thống tài khoản (idempotent).
2. **`packages/core/src/kho.ts`** — import `postInner`, ghi bút toán trong transaction:
   - `phNhapCreate` (loại `moi`, tong>0): **Nợ 152 / Có 331** (công nợ NCC).
   - `autoXuatSC` (body tx, tong>0): **Nợ 154 / Có 152** (CP dở dang), `ref_id = scId`.
   - `phXuatCreate` (loại `dung`, sum>0): **Nợ 154 / Có 152**, `ref_id = rec.ref_sc || id`.
3. **`packages/core/src/asset.ts`** — import `postInner`:
   - `quyetToan`: sau khi ghi `lich_sua`, kết chuyển: đóng 154 (Vật tư dở dang → `ref_id=scId`), hạch toán nhân công nội bộ **Nợ 642 / Có 334** và ngoài **Nợ 642 / Có 331** (join `phieu_sua.la_sua_ngoai`). Tổng Nợ 642 = vật tư + nhân công.
   - `khauHaoPost(api, {bks|xe_id})` (mới): **Nợ 627 / Có 214**, check quyền `asset.quyet`.
4. **Test (`packages/core/tests/ketoan-integ.test.ts`)** — 3 ca: (a) nhập+xuất → 152 khớp Δ tồn kho, 154 dở dang; (b) SC full-flow → quyết toán đóng 154, 642 = vật tư + nhân công nội bộ; (c) khấu hao → 627/214.

## Kết quả kiểm thử
- `npm run typecheck` (packages/core) → exit 0.
- `npx vitest run` (packages/core) → **271/271 pass** (contract 82, ledger 6, ketoan-integ 3, ketoan-gd2 2, ketoan-gd3 9; kho/asset/khachhang cũ vẫn xanh).
- Live DB: migrate thành công (xác nhận `tai_khoan.133`=1, `khach_hang.la_ncc`=1, `phieu_chi` tồn tại=1).

## GĐ3 — VAT / Công nợ NCC / Phiếu chi (ĐÃ XONG)
1. **Schema** — `khach_hang` thêm `la_ncc BOOLEAN` (master NCC chung); bảng `phieu_chi` (id, ngay, nguoi, cong_no_id, so_tien, hinh_thuc, nguoi_nhan, note); `tai_khoan` bổ sung **133** (Thuế GTGT được khấu trừ). Cập nhật CẢ `schema.sql` (test) và `accounting.sql` (live migration).
2. **`kho.phNhapCreate`** — tích hợp: VAT (`vat?` → Nợ 152 + Nợ 133 / Có 331 hoặc 112 nếu `tra_ngay`), sinh `cong_no` phai_tra khi chưa trả ngay, cập nhật `vattu.gia` bình quân gia quyền + `ton_lot` (GĐ2-hoàn-thiện).
3. **`ketoan.vatInvoiceSave`** — lưu `vat_invoice` + Nợ 133 / Có 331; liên kết công nợ NCC (tăng thuế phải trả) nếu có `ref_id`.
4. **`ketoan.phieuChiCreate`** — giảm `cong_no`, chặn vượt nợ, Nợ 331 / Có 112; đóng công nợ khi hết nợ.
5. **`ketoan.congNoList`** — danh sách công nợ (phai_tra) + tuổi nợ (qua_han).
6. **Contract / perm / rpc-dispatch** — đăng ký `vatInvoiceSave`(ke_toan.vat), `phieuChiCreate`(ke_toan.chi), `congNoList`(ke_toan.xem) + payloads + MATRIX.

## GĐ4 — Báo cáo & Khóa kỳ (ĐÃ XONG)
1. **`ketoan.ledgerReport`** — CĐKT (group tài khoản, số dư theo loại), KQHĐKD chi phí (621/622/627/641/642), sổ 152/331/133.
2. **`ketoan.buildReportHtml`** — xuất HTML A4 (thay `.docx` theo luật AGENTS).
3. **`ketoan.kyClose`** — đánh dấu `ky_ke_toan.da_dong`; `postInner` (ledger.ts) đã chặn ghi chứng từ trong kỳ đóng.
4. **Contract / perm / rpc-dispatch** — `ledgerReport`(ke_toan.baocao), `kyClose`(ke_toan.ky) + MATRIX.
5. **Test** `ketoan-gd3.test.ts` — VAT 133, phiếu chi 331/112, chặn vượt nợ, CĐKT cân bằng (TS=NV), khóa kỳ chặn ghi + **kyOpen mở lại kỳ**.

## Cải tiến an toàn & vận hành (từ Production Check)
1. **Escape HTML (XSS-safe)** — `buildReportHtml` dùng hàm `esc()` escape `& < > " '` cho mọi dữ liệu động (tên tài khoản, đối tác, ngày). Thêm nút "In / Xuất PDF" (`window.print()`) + `@media print` style.
2. **Mở lại kỳ (`kyOpen`)** — quyền `ke_toan.ky`; cho phép sửa bổ sung chứng từ sau khi khóa nhầm. Test vòng đời: đóng → mở → ghi OK.
3. **Reseed permissions live** — script `scripts/reseed-perms.ts` (chạy `npx tsx scripts/reseed-perms.ts`), đồng bộ `phan_quyen` từ MATRIX (119 quyền). Không còn phụ thuộc fallback.
4. **Load test k6** — `tests/load/k6_ledgerpost.js` (ramp 10→100 VUs, threshold p95<500ms, error<1%). Chạy: `k6 run tests/load/k6_ledgerpost.js` (cần cài k6 + session cookie).
5. **E2E Playwright template** — `tests/e2e/ketoan.spec.ts` smoke test RPC (ledgerPost, vatInvoiceSave, phieuChiCreate, congNoList, ledgerReport, kyClose+kyOpen). Chạy: `npx playwright test tests/e2e/ketoan.spec.ts` (cần BASE_URL + SESSION_COOKIE).
6. **Server-side PDF (puppeteer)** — `buildReportPdf` trong `ketoan.ts` + API route `/api/export/ke-toan` trả `application/pdf`. Xuất PDF chuẩn A4, không cần client-side lib.
7. **React UI Kế toán (Full)** — 5 trang: Dashboard, Nhập/VAT, Công nợ, Báo cáo, Khóa kỳ. Tích hợp RPC (`useRpc`), realtime, permission, modal form, export PDF. Nav sidebar + `KeToanNav` component.
8. **CI GitHub Actions (Nightly k6)** — `.github/workflows/k6-nightly.yml`: chạy k6 hàng ngày 02:00 UTC, cài k6, build web, start server, run load test, upload artifacts.

## Rủi ro / lưu ý
- `postInner` dùng `db.transaction` + nextId trên bảng `config` (FOR UPDATE) → an toàn race khi nhiều user ghi đồng thời (kho/asset gọi trong tx của riêng họ, không double-wrap).
- `la_sua_ngoai` nằm ở `phieu_sua`, KHÔNG phải `sc_congviec` → truy vấn nhân công phải JOIN.
- COGS: `phNhapCreate` đã cập nhật `vattu.gia` trọng số bình quân thực sự + `ton_lot`; `tinhGiaVon` hỗ trợ `binh_quan`/`fifo`. `reconcileKho` đối soát 152≡tồn kho, 331≡công nợ, 154 dở dang.
- **Đã reseed `phan_quyen` live** (119 quyền) — MATRIX thay đổi cần chạy lại `npx tsx scripts/reseed-perms.ts`.
- E2E/k6 cần môi trường: web server chạy, k6 cài đặt, Playwright browsers (`npx playwright install`), session cookie hợp lệ.
