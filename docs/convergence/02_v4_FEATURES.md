# Tính năng v4.0_supa (nguồn: apps/web + packages/core)

> **Purpose:** đối chiếu feature v4 (working tree `E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa`, draft `untracked/modified` — tham chiếu tag v4.0.0 `03594d4` + changelog v4.2.0/v4.3.0) với v5 đã commit (HEAD `08996b4`, v5.0.0).
> **Phương pháp (read-only):** glob + đọc header/export `packages/core/src/*.ts`, `apps/web/components/**`, routes `apps/web/app/(app)/**`; đối chiếu `git ls-tree HEAD` / `git show HEAD:<file>` / `git ls-files --others` để xác định chính xác hạng mục **thiếu** ở v5.
> **Ký hiệu:** ❌ = v5 (HEAD) KHÔNG có · 🟡 = v5 có bản cơ sở, draft v4 mở rộng · ✅ = cả hai.

---

## 1. UI/UX (theme, dark mode, workspace, palette, notification…)

| ID | Tên | File | Mô tả |
|---|---|---|---|
| UI-01 | ❌ Context đa workspace 4 trục | `apps/web/components/WorkspaceContext.tsx` (untracked) | Xưởng / Kho & Mua / Kế toán / Quản trị; đồng bộ theo pathname + `?ws=` URL + localStorage; lọc `allowed` theo perms; R1 chặn chuyển ws không quyền (chống IDOR trên UI) |
| UI-02 | ❌ WorkspaceSelector | `apps/web/components/WorkspaceSelector.tsx` | Dropdown đổi workspace gắn ở Topbar, chỉ hiện ws được phép |
| UI-03 | ❌ WorkspaceTheme `[data-ws]` | `apps/web/components/WorkspaceTheme.tsx` + `globals.css` | Set `data-ws` + class `view-only` lên `<body>` → CSS isolate màu theo ws (xuong blue / kho+ketoan green / quantri) — nền tảng theme 3 trục |
| UI-04 | 🟡 Topbar: bấm “Bật chỉnh sửa” (PA1) | `apps/web/components/Topbar.tsx` (draft diff) | Nút + modal xác nhận cho giám đốc bật editMode; backend `can()` giữ nguyên, UI không gửi POST khi view-only |
| UI-05 | ❌ ReadOnlyGuard (view-only) | `apps/web/components/ReadOnlyGuard.tsx` | Bọc vùng form: vô hiệu mọi input/select/textarea/button + ẩn nút `.edit-action` khi giám đốc chưa bật chỉnh sửa |
| UI-06 | ❌ 3 kiểu theme Glass/Bold/Calm | `apps/web/app/globals.css` (draft diff) | `.theme-home` = Glass (gradient xanh-vàng, card kính), `.theme-dash` = Bold (KPI to, hover lift), `.theme-default` = Calm (draft thêm mới so với HEAD) |
| UI-07 | ✅ Dark mode + system preference | `apps/web/components/ThemeProvider.tsx` + `.dark` tokens | Toggle `.dark` trên `<html>`, lưu localStorage, fallback `prefers-color-scheme`; route-theme (`/home`→Glass, `/dashboard`→Bold) (HEAD đã có bản cơ sở) |
| UI-08 | ❌ GlobalSearch (dropdown) | `apps/web/components/GlobalSearch.tsx` + `packages/core/src/search.ts` | Debounce 250ms qua RPC `globalSearch`, dropdown nhóm SC / Xe / Đề xuất (+vattu GĐ4), click navigate chi tiết |
| UI-09 | 🟡 CommandPalette Ctrl+K | `apps/web/components/CommandPalette.tsx` | Phím tắt Ctrl/Cmd+K mở modal lệnh nhanh (tạo phiếu, nhập/xuất kho, đề xuất…); draft bổ sung mục vào workspace kế toán |
| UI-10 | 🟡 NotificationCenter realtime | `apps/web/components/NotificationCenter.tsx` + `Shell.tsx` (diff) | Badge số chờ (SC chờ duyệt, đề xuất, DM…) + `useRealtimeMulti(['phieu_sua','de_xuat_sua_chua','dm_mua','chat_messages'])` refresh tức thì — thay polling 45s |
| UI-11 | ❌ StatusPipeline 8 bước QC206 | `apps/web/components/StatusPipeline.tsx` | Thanh tiến trình Đề xuất→Duyệt→Kiểm tra→Lập SC→Sửa→Nghiệm thu→**Thu hồi VT hỏng**→Quyết toán; gọi RPC `scTienTrinh`; badge cảnh báo đỏ nếu chưa thu hồi vật tư cũ (P2.2b). (v5 có backend `scTienTrinh` nhưng KHÔNG có UI pipeline) |
| UI-12 | ❌ ExcelTable kiểu Excel | `apps/web/components/ui/ExcelTable.tsx` | Grid “CarDoctor excel-like”: sort 2 chiều có `aria-sort`, filter inline từng cột, ô tìm toàn bảng, đếm “n dòng”, phân trang client, tự reload khi `realtimeTables` đổi |
| UI-13 | ❌ Pager server-side | `apps/web/components/Pager.tsx` | Combo với `list.ts`: total/page/limit/pages cho danh sách lớn |
| UI-14 | ❌ SubNav chuẩn hoá có permission | `apps/web/components/SubNav.tsx` | Sub-nav tab trong module, mỗi item khai `perm` → tự ẩn nếu không quyền |
| UI-15 | ❌ KeToanNav | `apps/web/components/KeToanNav.tsx` | 5 tab kế toán: Tổng quan / Nhập-VAT / Công nợ NCC / Báo cáo / Khóa kỳ |
| UI-16 | ❌ ChartCard SVG thuần | `apps/web/components/ui/ChartCard.tsx` | Card biểu đồ pie/bar tự vẽ SVG, không dependency ngoài (dùng ở kho + ketoan dashboard) |
| UI-17 | ❌ States (Empty/Loading/Error) | `apps/web/components/ui/States.tsx` | Bộ trạng thái UX nhất quán mọi trang (HEAD chỉ có EmptyState + Skeleton rời) |
| UI-18 | ❌ ScHoSoPanel in-tab | `apps/web/components/ScHoSoPanel.tsx` | Tab “Hồ sơ” trong phiếu SC: xem Mẫu 2/7/8 inline + “In Mẫu” (HTML A4, tránh popup chặn in) + “Xuất hồ sơ 9 tab xlsx” qua `/api/export/sc-hoso/[id]` |
| UI-19 | ❌ PWA cài được | `PwaRegister.tsx` + `app/manifest.ts` + `public/sw.js` | Manifest standalone, register service worker — HEAD **không có** sw.js/manifest |
| UI-20 | 🟡 MobileBottomNav theo workspace | `apps/web/components/MobileBottomNav.tsx` | Drawer dưới mobile đổi bộ 3 nav (Xuong/Kho/Ketoan) theo ws hiện tại (`lib/nav-items.ts`) |
| UI-21 | ❌ Route board xe /sc/kanban | `apps/web/app/(app)/sc/kanban/page.tsx` (component `Kanban.tsx` có ở HEAD) | Bảng 5 cột trạng thái xe + VehicleCard, click mở modal |
| UI-22 | ❌ Route /sc/dashboard xưởng | `apps/web/app/(app)/sc/dashboard/page.tsx` (backend `scDashboard` có ở HEAD) | KPI xưởng: Tổng SC, “chưa có HĐ” (P2.2a) danger-flag… |
| UI-23 | ❌ Routes quản lý xe /xe** | `xe/page.tsx`, `xe/new/page.tsx`, `xe/[bks]/page.tsx` | Danh sách xe, thêm xe, chi tiết + lý lịch per-xe (backend `xe.ts` HEAD đã có, UI thiếu) |
| UI-24 | ❌ Route nhắc hạn /nhac-han | `nhac-han/page.tsx` | Lọc `xeReminders({days})` — lịch hẹn/bảo dưỡng sắp tới (backend có ở HEAD, UI thiếu) |
| UI-25 | ❌ Route /audit | `audit/page.tsx` | Bảng tra `log_audit` cho quản trị |
| UI-26 | ❌ Route in A4 /in/[type]/[id] | `app/in/[type]/[id]/page.tsx` | In HTML A4 thay .docx — HEAD **không có** `app/in/*` |
| UI-27 | ✅ KpiCard theme-aware | `apps/web/components/KpiCard.tsx` | Style thừa hưởng theo theme cha `.theme-home`/`.theme-dash` (HEAD đã có) |
| UI-28 | ✅ VehicleDetailModal | `apps/web/components/VehicleDetailModal.tsx` | Timeline 5 bước Lập→Duyệt→Bắt đầu→Hoàn thành→Nghiệm thu; ESC/click nền đóng (verbatim A06.4/A07) |
| UI-29 | ✅ SkipLink WCAG | `apps/web/components/SkipLink.tsx` | “Skip to main content” hiện khi Tab — a11y |

**Tổng section 1: 29 dòng — ❷❶ 21 mục ❌ v5 thiếu hoàn toàn, 4 mục 🟡 v5 có bản cơ sở, 4 mục ✅ hai bên.**

---

## 2. Nghiệp vụ mở rộng (ketoan / khachhang / baoduong / ledger / search / mailer…)

### 2a. Kế toán VAS cost-side — `packages/core/src/ketoan.ts` + `ledger.ts` (v4.2.0) — module vắng mặt toàn phần ở v5 HEAD
| ID | Tên | File | Mô tả |
|---|---|---|---|
| NV-01 | ❌ ledgerPost sổ cái kép | `ledger.ts` | Ghi chứng từ + bút toán; ràng buộc: mỗi dòng đúng 1 bên Nợ/Có > 0, ΣNợ = ΣCó, tài khoản phải tồn tại, không ghi vào kỳ đã đóng; transaction + audit; trả `{ok,error}` không throw |
| NV-02 | ❌ ledgerList | `ledger.ts` | Tra cứu bút toán lọc theo tài khoản / ngày / loại chứng từ, quyền `ke_toan.xem` |
| NV-03 | ❌ postInner | `ledger.ts` | API ghi bút toán **trong transaction của module khác** (kho/SC/asset tích hợp GĐ2) |
| NV-04 | ❌ getCogsMethod + tinhGiaVon | `ledger.ts` + `ketoan.ts` | Giá vốn xuất theo `cogs_method`: bình quân gia quyền (mặc định) hoặc FIFO từ `ton_lot` |
| NV-05 | ❌ Schema kế toán | `packages/db/src/accounting.sql` | `tai_khoan` CoA 21 tài khoản VAS (111,112,133,152,153,154,156,211,214,331,3331,334,421,621,622,627,641,642,632,911…), `chung_tu`, `ledger` (constraint `chk_ledger_side`), `ky_ke_toan`, `ke_toan_setting`, `ton_lot`, `cong_no`, `vat_invoice`, `phieu_chi`, `so_quy`; tiền NUMERIC(14,2); seed idempotent `coa_seed.sql` |
| NV-06 | ❌ reconcileInit | `ketoan.ts` | Khởi tạo số dư đầu kỳ go-live (opening) để đối chiếu có baseline — chạy 1 lần |
| NV-07 | ❌ reconcileKho | `ketoan.ts` | Đối chiếu tự động **Kế toán ↔ Kho ↔ Công nợ**, trả các khoản lệch (diff) + notes |
| NV-08 | ❌ vatInvoiceSave | `ketoan.ts` | Lưu hóa đơn VAT đầu vào + hạch toán **Nợ 133 / Có 331**, liên kết công nợ NCC (tăng thuế phải trả) |
| NV-09 | ❌ phieuChiCreate | `ketoan.ts` | Phiếu chi trả công nợ NCC: giảm `cong_no`, **chặn vượt nợ**, Nợ 331 / Có 112, đóng công nợ khi hết |
| NV-10 | ❌ phieuThuCreate | `ledger.ts` | Sổ quỹ thu nội bộ (B5): Nợ 111/112, Có 331/334/421 — KHÔNG doanh thu/AR (mô hình cost-side) |
| NV-11 | ❌ congNoList | `ketoan.ts` | Danh sách công nợ phải trả + **tuổi nợ** (qua hạn) |
| NV-12 | ❌ congNoChuaCoHoaDon | `ketoan.ts` | Cảnh báo công nợ chưa có hóa đơn VAT về (rủi ro thuế) |
| NV-13 | ❌ ledgerReport | `ketoan.ts` | Báo cáo: **Bảng cân đối kế toán** (số dư theo loại TK), **KQHĐKD chi phí** (621/622/627/641/642), sổ chi tiết 152/331/133, nhánh quỹ `so_quy` |
| NV-14 | ❌ kyClose / kyOpen | `ketoan.ts` | Khóa kỳ kế toán (đánh dấu `da_dong` → postInner từ chối ghi ngược), mở lại quyền `ke_toan.ky` |
| NV-15 | ❌ buildReportHtml | `ketoan.ts` | Xuất báo cáo **HTML A4 in được** (thay .docx theo luật AGENTS), escape XSS dữ liệu động |
| NV-16 | ❌ buildReportPdf + ledgerReportPdf | `ketoan.ts` | PDF server-side qua puppeteer, RPC binary response cho export API |
| NV-17 | ❌ Tích hợp Kho→Kế toán | `kho.ts` (draft) | `phNhapCreate`: Nợ 152 (+Nợ 133 VAT) / Có 331 hoặc 112 nếu trả ngay, sinh `cong_no`, cập nhật giá bình quân + `ton_lot`; `autoXuatSC`/`phXuatCreate` dùng: **Nợ 154 / Có 152** |
| NV-18 | ❌ Tích hợp SC→Giá thành | `asset.ts` (draft) | `quyetToan`: đóng 154 theo `ref_id`, hạch toán nhân công nội bộ **Nợ 642/Có 334** + thầu ngoài **Nợ 642/Có 331** (HEAD có hàm nhưng KHÔNG bút toán) |
| NV-19 | ❌ Khấu hao tự động | `asset.ts` (draft) | `khauHaoPost` **Nợ 627 / Có 214**, quyền `asset.quyet` |
| NV-20 | ❌ Route UI kế toán 5 trang | `app/(app)/ke-toan/{dashboard,nhap-vat,cong-no,bao-cao,khoa-ky}/page.tsx` | Dashboard Thu/Chi + ChartCard pie cơ cấu; form nhập VAT; bảng công nợ + phiếu chi; report A4; quản trị khóa/mở kỳ — HEAD có **0/5** route |

### 2b. Khách hàng / nhà cung cấp — `khachhang.ts` (v5 HEAD không có file)
| ID | Tên | File | Mô tả |
|---|---|---|---|
| NV-21 | ❌ CRUD khách hàng | `packages/core/src/khachhang.ts` | `khachHangList/Get/Save/Del` (GĐ-4, port v3.6 giữ nguyên hành vi) + cột `ma_so_thue`, flags `la_ncc` (master NCC chung cho mua hàng) |
| NV-22 | ❌ Trang /khach-hang | `app/(app)/khach-hang/page.tsx` | Form thêm/sửa (Tên, SDT, Địa chỉ, Email, Mã số thuế, Ghi chú) + Pager |

### 2c. Bảo dưỡng định kỳ — `baoduong.ts` (v4.3 P3, v5 HEAD không có file)
| ID | Tên | File | Mô tả |
|---|---|---|---|
| NV-23 | ❌ Lịch bảo dưỡng xe | `packages/core/src/baoduong.ts` | `baoDuongTao`/`baoDuongList` trên bảng `bao_duong_lich` (xe_id, hạng mục, ngày dự kiến/thực hiện, trạng thái); validate + parameterized + audit + soft-delete |
| NV-24 | ❌ Trang nhắc hạn | `app/(app)/nhac-han/page.tsx` | UI hẹn bảo dưỡng/sửa tới hạn theo `xeReminders(days)` (kết hợp NV-23 thành loop cảnh báo định kỳ) |

### 2d. Search / phân trang / init / mail / báo cáo bổ sung
| ID | Tên | File | Mô tả |
|---|---|---|---|
| NV-25 | ❌ globalSearch | `search.ts` | Tìm toàn cục **SC + xe + đề xuất + vật tư** (B10), quyền `search.xem` cấp mọi role, chỉ dữ liệu `deleted_at=''` |
| NV-26 | ❌ paginate thật | `list.ts` | `paginate()`/`normPage()`: truy vấn COUNT + LIMIT/OFFSET dùng chung, trả mảng tương thích ngược kèm `.total/.page/.pages` — mọi list + Pager UI-13 hưởng |
| NV-27 | ❌ Bundle init form | `init.ts` | `currentUser`/`appInfo`/`myPerms`/`vehiclesOptions`/`phongbanList`/`checklistGroups`/`formInitData` — một RPC đổ sẵn dữ liệu khởi tạo mọi form (HEAD không có file) |
| NV-28 | ❌ Mailer tự chứa | `mailer.ts` | Abstraction NoopMailer↔SmtpMailer(nodemailer) tự bật khi có `SMTP_HOST` — nền cho reset mật khẩu + nhắc hạn (GĐ-5/4), không ép dependency |
| NV-29 | ❌ Hồ sơ SC 9 tab xlsx | `report.ts`: `scHoSoXlsx` | Gom toàn bộ hồ sơ 1 phiếu sửa (SC, định mức, kho, đề xuất, quyết toán…) thành workbook 9 sheet |
| NV-30 | ❌ Báo cáo chi phí | `report.ts`: `baoCaoChiPhi`, `doiSoat` | Thống kê chi phí sửa chữa kỳ + đối chiếu chứng từ nguồn↔báo cáo (HEAD chỉ có 4 workbook tồn kho/xuất/quyết toán/đề xuất) |

### 2e. Có ở cả hai (để không trùng lặp khi converge)
| ID | Tên | File | Mô tả |
|---|---|---|---|
| NV-31 | ✅ Vai trò xem thử | `preview.ts` + route `/preview` | Admin giả lập 8 role (giamdoc/quanly/ketoan/tho/khovattu/xuong/pttb/laixe) với mẫu DEMO in-memory |
| NV-32 | ✅ Đề xuất→SC | `de_xuat.ts` | Luồng cho_duyet→da_duyet/tu_choi→`deXuatToSC`, cached + realtime |
| NV-33 | ✅ Hồ sơ kế toán (chứng từ) | `ho_so.ts` | Save/get/list `ho_so` GĐ5 chỉ `ketoan` được lưu |
| NV-34 | ✅ Welcome tiếng Việt | `welcome.ts` | greeting theo giờ, `viDate()` thứ/ngày/giờ, danh sách shortcut → nuôi NotificationCenter |
| NV-35 | ✅ Chữ ký số + ký tay | `nhanKy.ts` | Mỗi phiếu nhiều vị trí ký (người lập/thủ kho/lái xe…), in ảnh ký khi có |
| NV-36 | ✅ Cache Redis/In-memory | `cache.ts` | `cached()` TTL, tự chuyển Redis khi có `REDIS_URL` (multi-instance) |

**Tổng section 2: 36 dòng — 30 mục ❌ v5 thiếu, 6 mục ✅.**

---

## 3. Bộ lọc 3 trục ưu tiên: Xưởng | Mua sắm DM | Kho — v4 có gì mà v5 chưa có

### Trục 1 — Xưởng (`ws=xuong`, prefix /sc)
| Tính năng | File | Trạng thái |
|---|---|---|
| Pipeline 8 bước trực quan + P2.2b | `StatusPipeline.tsx` | ❌ v5 thiếu UI (backend có) |
| Bảng Kanban xe 5 cột | route `sc/kanban` | ❌ |
| KPI xưởng “chưa có HĐ” danger | route `sc/dashboard` | ❌ (backend `scDashboard` có) |
| In-tab hồ sơ Mẫu 2/7/8 + xuất bộ 9-sheet | `ScHoSoPanel.tsx`, `scHoSoXlsx` | ❌ |
| History phương tiện, nhắc định kỳ | route `/xe/*`, `/nhac-han` | ❌ UI (backend có) |
| Lịch + trạng thái bảo dưỡng | `baoduong.ts`, `bao_duong_lich` | ❌ module |
| Ảnh đính kèm phiếu `phieu_sua.hinh_anh TEXT[]` + `scAnhSave` | `sc.ts` | ✅ cả hai |
| Giám sát activity feed | route `giamdoc/feed` + `activity.ts` | ✅ cả hai |

### Trục 2 — Kho (`ws=kho/…/kho`)
| Tính năng | File | Trạng thái |
|---|---|---|
| Sheet tổng nhập-xuất-tồn XNT + history vật tư + chuyển kho | `kho.ts`: `tonKhoReport`, `vatTuHistory`, `phChuyenKhoCreate` | ✅ backend cả hai (v5 đã nhận B2–B4) |
| Trang kho kèm summary card + ChartCard “Tồn kho theo nhóm” (C2) | `kho/page.tsx` draft | ❌ bản đồ họa chỉ ở draft |
| Kho tự hạch toán sổ kép (NV-17) | `kho.ts`+`postInner` | ❌ (v5 không có ledger) |
| ExcelTable lọc/sort/realtime cho bảng vật tư, phiếu | `ui/ExcelTable.tsx` | ❌ |

### Trục 3 — Mua sắm DM (`ws=kho`, /kho/dm + /baogia)
| Tính năng | File | Trạng thái |
|---|---|---|
| Vòng đời Đề nghị mua DM (create từ SC/báo giá, duyệt ngưỡng, đủ bộ auto rebut) | `kho.ts` `dm*` | ✅ cả hai |
| Báo giá NCC không AI-OCR, items gắn `dm_id` | `baogia.ts` | ✅ cả hai |
| realtime badge/DM khi đổi trạng thái | `de-xuat`/`kho/dm` draft + `useRealtime` | 🟡 có ở HEAD, draft thêm subscribe realtime vào `useRealtime` |
| Mua vượt ngưỡng chặn + báo Nợ 331 khi nhập | `ketoan` integration | ❌ |
| Công nợ NCC + thanh lý phiếu chi | NV-09/11 | ❌ |

**Kết trục:** trục Xưởng thiếu nhiều lớp UI nhất; trục Kho thiếu tầng kế toán + dashboard biểu đồ; trục Mua thiếu chuỗi VAT→công nợ→chứng từ, còn nghiệp vụ DM cơ bản đã hòa hợp.

---

## 4. Top 10 tính năng “đắt giá” v4 mà v5 thiếu

| # | Tính năng | File nguồn | Lý do đắt giá |
|---|---|---|---|
| 1 | **Hệ thống kế toán VAS sổ kép đầy đủ** (CoA 21 TK, chứng từ, cân đối, KQ chi phí, khóa kỳ, HTML A4/PDF) | `ketoan.ts`, `ledger.ts`, `accounting.sql`, 5 route `ke-toan/*` | Không kế toán = không đóng được chi phí thật → mọi báo cáo lãi/lỗ chỉ một nửa. Đây là khoản đầu tư nghiệp vụ lớn nhất đã được TDD xanh (271–316 test v4.2/4.3) mà v5 bỏ hẳn |
| 2 | **Tích hợp tự động Kho/SC/Tài sản → bút toán** (Nợ 152/Có 331, Nợ 154/Có 152, 642/334-331, 627/214) | `kho.ts`, `asset.ts` draft | Xóa khớp tay kế toán-kiệm kho; sai số = 0. v5 có kho &_SC & quyet toán nhưng **mất chân nối** sổ |
| 3 | **Đa workspace 4 trục + theme Glass/Bold/Calm + `[data-ws]`** | `Workspace*`, `globals.css` | Một core phục vụ 4 nhóm công việc với UX riêng; không còn “admin console” một màu cho thợ/kho/kế toán — giá trị UI/UX Pro Max cao nhất bản v4 |
| 4 | **Chế độ Giám đốc view-only (PA1)** | `ReadOnlyGuard.tsx`, `WorkspaceContext`, Topbar | Lãnh đạo soi số an toàn, chỉ bật sửa khi xác nhận modal; an toàn dữ liệu + chính trị nội bộ |
| 5 | **GlobalSearch + CommandPalette** | `GlobalSearch.tsx`, `search.ts`, `CommandPalette.tsx` | Tìm xuyên SC/xe/đề xuất/vật tư 250ms, Ctrl+K điều hướng thao tác — tăng tốc vận hành thực tế xưởng gấp nhiều lần |
| 6 | **ExcelTable (sort/filter/search/paginate/realtime)** | `ui/ExcelTable.tsx` | Kế toán & kho xử lý nghìn dòng Excel-style ngay trên web — đặc trưng CarDoctor, giảm hẳn xuất-nhập lại |
| 7 | **Chuỗi vòng đời xe: lịch bảo dưỡng + nhắc hạn + lý lịch + đánh giá** | `baoduong.ts`, `nhac-han` UI, `/xe/*` UI | Biến gara thành dịch vụ chủ động (hẹn định kỳ) thay vì cứu hộ bị động; backend v5 đã đủ, thiếu đúng phần UI+nhắc |
| 8 | **Khách hàng/NCC master (MST, la_ncc) + công nợ tuổi nợ + cảnh báo thiếu HĐ VAT** | `khachhang.ts`, `/khach-hang`, NV-12 | Nền quản lý thu chi với bên thứ ba, chống lọt hóa đơn thuế — hai module v5 không có file |
| 9 | **In hồ sơ A4 + xuất bộ 9 sheet xlsx mỗi SC** | `/in/*`, `ScHoSoPanel`, `scHoSoXlsx` | Chứng từ giấy theo nghị định + hồ sơ điện tử; HEAD không có `app/in/*` lẫn export route |
| 10 | **PWA offline-on-LAN + realtime notification không polling** | `manifest.ts`, `sw.js`, `Shell.tsx` realtime | Cắm tablet xưởng dùng như app native; badge cập nhật tức thời qua Supabase Realtime đúng chuẩn v4 chốt “bỏ polling 45s” |

---

⚠️ **Lưu ý hệ thống sản xuất (Production Check)** — dành cho báo cáo nghiên cứu:
1. **Con thiếu gì?** Không có — đây là điều tra chỉ-đọc; chỉ tạo file này.
2. **Rủi ro ở đâu?** workingtree hiện là HEAD v5 + patch-draft v4 chưa commit; đọc nhầm “có trên đĩa = có trong v5”; đã giảm bằng đối chiếu `git ls-tree HEAD`/`git show` từng hạng mục trước khi gắn nhãn ❌/🟡/✅.
3. **Đã kiểm chứng chưa?** ✅ 65 hạng mục liệt kê (29 UI/UX + 36 nghiệp vụ) ở cấp file/route, đối chiếu `git ls-tree HEAD`/`git show HEAD:<file>`/`git ls-files --others`; changelog (`docs/CHANGELOG.md`, `changelog_ketoan_v4.2.0.md`, `changelog_v4.3.0.md`, `changelog_testfix.md`) khớp nội dung kiểm tra.
4. **Đề xuất tiếp theo?** Khi merge convergence, ưu tiên nhóm kéo theo test lớn trước: `ketoan+ledger+accounting.sql` (316 bài test core), kế đó Workspace/PA1 (touched contract), rồi PWA/in-route; kiểm `changelog_testfix` để mang theo bộ E2E Playwright + video khi nhập phiên.

*Tổng dòng liệt kê §1+§2 = 65 đặc điểm (29 UI/UX + 36 nghiệp vụ): 51 ❌ v5 thiếu hẳn · 4 🟡 v5 có bản cơ sở, draft v4 mở rộng · 10 ✅ đã có cả hai.*
