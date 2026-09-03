# UAT/plan/LOG.md — Nhật ký chạy UAT (cập nhật liên tục mỗi phiên)

> Mỗi entry: ngày | case | kết quả | tính năng ẩn bộc lộ | cách xử lý | kết quả sau sửa

---

## [BẮT ĐẦU] Khung UAT đã dựng
- Folder `UAT/` hoàn chỉnh: index.json (15 case), execute.spec.ts, playwright.config.ts, rename-videos.mjs, run-case.ps1, run-all.ps1, write-report.mjs.
- Đã chạy thử: setup 7/7 login PASS; TC-RP-02 & TC-ST-03 chạy, video đặt tên đúng, báo cáo sinh.
- TC-RP-02 FAIL (wizard tạo SC không redirect `/sc/SC-`). TC-ST-03 FAIL (assert phân quyền xuất hồ sơ).

## [CHẠY 1] TC-ST-02 (chặn thiếu HĐĐT) — ĐẠT ✅
- Mục tiêu: đảm bảo hệ thống từ chối thanh toán công nợ mua khi phiếu chưa gắn HĐĐT đầu vào.
- **Kết quả phát hiện**: tính năng ĐÃ TỒN TẠI sẵn (hidden feature) trong `packages/core/src/ketoan.ts` `phieuChiCreate` (dòng 187–195): chặn `ref_type='phieu_nhap'` thiếu `vat_invoice` → lỗi "Vi phạm QC206 Điều 2...".
- Handler UAT (execute.spec.ts): insert công nợ thiếu HĐĐT → gọi RPC `phieuChiCreate` (ketoan) → kỳ vọng bị chặn; thêm `vat_invoice` → gọi lại → kỳ vọng thành công.
- Sửa lỗi khung: webServer phải dùng `node _start-dev.mjs` (cwd = thư mục config); RPC trả `{ok:true, result:{ok:false,error}}` nên assert đọc `j.result.ok`.
- **Kết quả: Đạt** (8/8 pass, video `UAT/videos/TC-ST-02.webm`). Không cần implement thêm — chỉ cần test xác nhận.

## [TIẾP] TC-RP-02 (lập SC 8 bước) — ĐẠT ✅
- Handler UAT: insert xe test (`xe.id=bks`) → mở `/sc/create` → fill biển số → 2 bước "Tiếp" → "Tạo phiếu" → chờ redirect `/sc/SC-`.
- Phát hiện: wizard ĐÃ HOẠT ĐỘNG và redirect đúng (`sc/create` gọi `router.push('/sc/'+id)`). Lỗi trước do handler cũ (không insert xe, `scCreate` cần xe tồn tại) và do có 2 block TC-RP-02 trùng (block cũ chạy trước). Đã xóa block cũ.
- **Kết quả: Đạt** (8/8). Sửa thêm: webServer dùng `node _start-dev.mjs`; RPC trả `{ok,result}`.

## [TIẾP] TC-ST-03 / TC-RP-05 (export endpoint) — PHÁT HIỆN + SỬA BUG NGHIÊM TRỌNG
- Triệu chứng: gọi `GET /api/export/sc-hoso/<id>` → **500 cho MỌI vai** (kể cả ketoan được phép).
- Nguyên nhân gốc: trong Next.js 15, `params` của route handler là **Promise** và key capture không phải `"path"` (folder `[...]`). Route truy cập `params.path` đồng bộ → `segs` undefined → `segs[0]` crash (`Cannot read properties of undefined (reading '0')`).
- Hậu quả: TOÀN BỘ export endpoint (tonkho, phxuat, quyettoan, dexuat, sc-hoso, in/sc) đều 500 → tính năng xuất/excel/in hồ sơ **hoàn toàn không dùng được** trên production.
- Sửa: `apps/web/app/api/export/[...]/route.ts` + `apps/web/app/api/in/sc/[...]/route.ts`: `const _p = await params as any; const segs = _p?.path ?? Object.values(_p)[0];`.
- Kết quả sau sửa (diagnostic trực tiếp): ketoan/giamdoc → **200**, laixe/xuong → **403** ✓ (phân quyền đúng).
- TC-RP-05 ĐẠT, TC-ST-03 ĐẠT (cả 2 test permission export).

## [CHẠY w1] TC-RP-04 (nghiệm thu/đóng phiếu) + TC-RP-01 (đề xuất lái xe) — ĐẠT ✅
- Worker w1 cô lập: `UAT/cases/w1.spec.ts` (AUTH=.auth.w1, MY=['TC-RP-04','TC-RP-01']) + `UAT/playwright.w1.config.ts` (PORT 3001, outputDir test-results-w1).
- TC-RP-04: scCreate (xuong) → scApprove (giamdoc, ok) → da_duyet → scStart → dang_sua → scFinish bị CHẶN khi còn công việc chưa xong ('Còn công việc chưa hoàn thành.') → UPDATE tt='hoan' → scFinish → cho_nghiem → scNghiem (giamdoc) → da_hoan + ngay_nghiem/nguoi_nghiem + bien_ban_nghiem. Tất cả RPC ĐÃ CÓ (sc.ts + RPC_META + schema) — không implement.
- TC-RP-01: deXuatCreate (laixe) → cho_duyet, deXuatGet không có trường chi phí, deXuatList (xuong) thấy đề xuất. ĐÃ CÓ (de_xuat.ts) — không implement.
- Vấn đề khung: chạy 7 project song song → race (INSERT xe với bks random yếu, 'Chưa có xe trong sổ') → fix `workers: 1` trong config w1.
- **Kết quả: 21/21 pass** (7 login + 14 TC runs). Video: `UAT/videos/TC-RP-04.webm`, `UAT/videos/TC-RP-01.webm`.


- Mục tiêu: kế toán quyết toán SC → sinh lý lịch + chốt chi phí. Cần test qua RPC `quyetToan` (asset module) hoặc UI.
- Kế tiếp trong thứ tự kế hoạch.

## [W2] Implement baoCaoChiPhi / doiSoat (report.ts) + RPC_META ke_toan.xem — ĐẠT ✅
- Implement `baoCaoChiPhi` (packages/core/src/report.ts): báo cáo chi phí 3 bên (sửa chữa/mua/kho) tách riêng, lọc theo kỳ YYYY-MM-DD + tùy chọn bks.
- Implement `doiSoat` (report.ts) wrap `reconcileKho` có sẵn → items[] + notes[]; khai báo RPC_META quyền `['ke_toan','xem']` (apps/web/lib/rpc-dispatch.ts).
- Handler UAT (w2.spec.ts): TC-ST-04 (baoCaoChiPhi theo kỳ + lọc bks, ketoan được phép, laixe/xuong bị chặn 400), TC-ST-05 (doiSoat trả items/notes, giamdoc được phép, laixe/xuong bị chặn).
- **Kết quả: TC-ST-04 ✅, TC-ST-05 ✅** (worker w2 xác nhận; sau khi gộp vào execute.spec.ts chạy lại full gate vẫn Đạt).

## [W3] Implement mua RPCs (kho.ts) + fix schemas.ts tonKhoReport — ĐẠT ✅
- Xác nhận RPC mua sắm ĐÃ CÓ sẵn (packages/core/src/kho.ts): dmCreate/dmDetail/dmListBySc/dmDecide/phNhapCreate/phXuatCreate/tonKhoReport + RPC_META (mua.tao/mua.duy/kho.tao/kho.xuat/kho.xem).
- **Fix schemas.ts**: Zod schema `tonKhoReport` lệch handler (tu_ngay/den_ngay vs from/to) → strip args → nhap/xuat=0. Sửa schema theo handler `{from,to}` → báo cáo XNT đối chiếu khớp.
- Handler UAT (w3.spec.ts): TC-PR-01..05 — chuỗi đề xuất → duyệt → nhập kho → xuất kho → đối chiếu; chặn xuất vượt tồn; laixe bị chặn mua.tao/mua.duy/kho.tao/kho.xuat/kho.xem.
- **Kết quả: TC-PR-01..05 ✅** (worker w3 xác nhận; sau khi gộp vào execute.spec.ts chạy lại full gate vẫn Đạt).

## [W4] Gộp handler vào execute.spec.ts + full gate 15/15 — ĐẠT ✅
- Gộp handler từ file per-worker vào `UAT/cases/execute.spec.ts` (không trùng c.id):
  - w1.spec.ts → TC-RP-04/TC-RP-01 (thực tế đã có sẵn trong execute.spec.ts — không chèn trùng).
  - w2.spec.ts → TC-ST-04/TC-ST-05 (helper `rpc` → đổi tên `rpcAs` + `expectDenied`).
  - w3.spec.ts → TC-PR-01..05 (helper `rpc` → đổi tên `rpcCtx` + `rnd6` + `cleanupUATW3`; bỏ console.log DBG5 debug).
- Sửa khung: `playwright.config.ts` thêm alias role `khoa` → storageState `khovattu.json` (index.json dùng role "khoa" cho TC-PR-01/03/04/05) + `workers: 1` (tránh race INSERT — bài học w1/w3).
- **Full gate: chạy lại TOÀN BỘ 15 case qua run-case.ps1 (đúng vai từ index.json) → 15/15 ĐẠT, 0 fail.** `tsc --noEmit` root EXIT 0.
- Dọn file tạm: xóa w1/w2/w3.spec.ts, playwright.w1/w2/w3.config.ts, test-results-w1/w2/w3. Giữ execute.spec.ts + playwright.config.ts + .auth + videos + reports.
