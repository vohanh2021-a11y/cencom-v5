# TASKS — TÍCH MỤC NHỎ THỰC THI UI v4 (từ plan_ui_15.08.md)

> Mỗi mục là 1 task nhỏ, độc lập file → có thể "làm luôn". Tick `[x]` khi xong.
> Tham chiếu: `docs/ui_v4/00`→`09`. Verify chung: `npm run typecheck` + `npm run build`.

## GĐ-A0 — Tailwind v4 migration ✅
- [x] A0.1 Bump deps: `package.json` → `tailwindcss@^4`, thêm `@tailwindcss/postcss`; xóa `autoprefixer`.
- [x] A0.2 `postcss.config.js` → `{ plugins: { '@tailwindcss/postcss': {} } }`.
- [x] A0.3 Xóa `apps/web/tailwind.config.ts`.
- [x] A0.4 `globals.css`: `@import "tailwindcss";` + `@theme{...}` + `@layer base{:root}` + `@layer components`.
- [x] A0.5 `npm install` + `npm run build` thành công.

## GĐ-A — Foundation ✅
- [x] A1 `globals.css`: tokens §01 + components §02 + themes §03; xóa `#2563eb`.
- [x] A2 `components/ui/Button.tsx` (variant/size, hover translateY(-1px)).
- [x] A2 `components/ui/Card.tsx` (default/glass/bold).
- [x] A2 `components/ui/Badge.tsx` (ok/warn/danger/info/neutral + kb sm).
- [x] A2 `components/ui/Skeleton.tsx` + keyframes shimmer.
- [x] A2 `components/ui/Modal.tsx` (portal, fadeIn+slideUp, ESC).
- [x] A2 `components/ui/Toast.tsx` (provider + useToast, 1.5s).
- [x] A2 `components/ui/EmptyState.tsx` + `Table.tsx`.
- [x] A3 `components/ThemeProvider.tsx` (body class theo usePathname) + `ToastProvider` (đã trong Toast.tsx).
- [x] A4 `components/CommandPalette.tsx` (Ctrl+K scaffold) + gắn vào `(app)/layout.tsx` (ToastProvider+ThemeProvider+CommandPalette).
- [x] A5 typecheck + build xanh.

## GĐ-B — Shell ✅
- [x] B1 `components/Sidebar.tsx` (gradient CENCOM verbatim, logo C, RBAC nav từ server, **bỏ 2 link Tablet/Lái xe**, active via `inset 3px 0 0 var(--c-accent)`).
- [x] B2 `components/Topbar.tsx` (menu-btn ☰, title theo route, whoChip, notifBtn+badge, LogoutButton).
- [x] B3 `components/NotificationCenter.tsx` (fixed `right:92px top:56px w:340px z:120`, badge tổng hợp từ `welcomeData` RPC: scChoDuyet+dmChoDuyet+dxChoDuyet+chatUnread+lowTon).
- [x] B4 Responsive (§08): 240 / 68px tablet (chỉ icon) / drawer+mobile+scrim; `prefers-reduced-motion` đã có.
- [x] B5 `(app)/login` redirect → `/home`; `(app)/layout.tsx` refactor → `Shell` (server fetch user/role/nav → client).
- [x] B6 typecheck 0 err + `npm run build` success (23 routes).

## GĐ-C — Home & Dashboard ✅
- [x] C0 `lib/use-rpc.ts` (hook gọi POST /api/rpc {fn,args} + refetch).
- [x] C1 `(app)/home/page.tsx` (Glass: banner, 5 KPI glass, quick pills, "Việc cần xử lý" từ `myTasks`, "Vật tư sắp hết" §05).
- [x] C2 `(app)/dashboard/page.tsx` (Bold: 8 KPI gradient, Kanban 5 cột group BKS, tho, báo cáo §06).
- [x] C2 `components/KpiCard.tsx`, `Kanban.tsx`, `VehicleCard.tsx` (render verbatim §06.2).
- [x] C3 `components/VehicleDetailModal.tsx` (timeline 5 bước verbatim §06.4-6.5, ESC/click-nền đóng).
- [x] C4 Công việc theo thợ (`.kb-tho`) + Báo cáo chi phí tháng (`.bc-row`) §06.6.
- [x] C5 `useRealtime('sc')` + `('de_xuat_sua_chua')` → `refetch()` tự cập nhật (thay polling 45s).
- [x] C6 typecheck 0 err + `npm run build` success.

## GĐ-D — Modules (8 subtask, song song được)
- [x] D1a `(app)/sc/page.tsx` — list filter (status/bks) + realtime + sc-row Calm (dùng `scList` ✅ khớp contract).
- [x] D1b `(app)/sc/[id]/page.tsx` — detail hiển thị (info + công việc + vật tư) dùng `scGet`.
- [x] D1c `(app)/sc/create` + actions (duyệt/từ chối/bắt đầu/nghiệm/hoàn tất/tổng duyệt) — **đã mở khóa** sau khi sửa contract: `scGet/scStart/scTongDuyet/scFinish` → `idStr`; `scApprove/scNghiem` → bỏ schema (positional); `scCreate` → tên trường khớp core. Detail có action bar theo trạng thái + quyền; create form có công việc/vật tư động.
- [x] D2 `(app)/kho/*` (vattu/dm/nhap/xuat) — **HOÀN THIỆN**: tồn kho CRUD (vatTuList/vatTuSave/vatTuDel); Đề nghị mua list + create + decide + **detail modal** (dmList/dmCreate/dmDecide/dmDetail); **Phiếu nhập/xuất có danh sách/lịch sử** (phNhapList/phXuatList) + tạo (phNhapCreate/phXuatCreate). Đã sửa hợp đồng Kho (như trên). Realtime `vattu`/`de_nghi_mua`/`phieu_nhap`/`phieu_xuat`.
- [x] D3 `(app)/chat/*` (threads+realtime+storage) — **FIX quan trọng**: hàm chat core nhận 1 object `rec` (không positional). Viết lại dùng `chatList`+`chatPeers`+`chatThreadOpen`+`chatSend({to,body})`+`chatSendImg({to,img})`+`chatDeleteMsg({id})`+`chatMessages({thread})`. Có gửi ảnh + xóa tin + realtime. RBAC chat.
- [x] D4 `(app)/asset/*` (quyết toán) — báo cáo tài sản (`assetReport`), tra cứu xe (`assetXe`→idStr), lịch sửa chữa (`lichSuaList`), quyết toán (`quyetToan`). RBAC `asset.xem`/`asset.quyet`.
- [x] D5 `(app)/de-xuat/*` (list/create/[id] state-machine) — list (deXuatList) + filter + realtime `de_xuat_sua_chua`; create (deXuatCreate); detail modal (deXuatGet); duyệt/từ chối (deXuatApprove `[id,action,lyDo]`); tạo phiếu SC (deXuatToSC). **Đã sửa hợp đồng DeXuat**: `lydo`→`mo_ta` + `dau_hieu`; `deXuatGet`/`deXuatToSC`→`idStr`; `deXuatApprove`→bỏ schema (positional).
- [x] D6 `(app)/baogia/*` — list (`baoGiaList`), tạo chứng từ (`baoGiaCreate`), chi tiết (`baoGiaGet`→idStr), xóa (`baoGiaDel`→idStr), **Sửa chứng từ (`baoGiaConfirm` `[id, rec]` positional)**. **Đã sửa hợp đồng BaoGia**: `ncc`→`ncc_ten`, item `sl`→`so_luong`, `baoGiaGet/Del`→idStr. RBAC `mua`.
- [x] D7 `(app)/thanhly/*` — danh sách vật tư thanh lý (`thanhLyList`, positional `{sc_id?}`). RBAC `kho.xem`.
- [x] D8 `(app)/preview/*` (demo theo vai — **2.4 ✅**) — chỉ admin; `previewInfo/Home/SC/Kho/DM` (positional `[role]`). **Contract**: chat/nhanKy bỏ schema (positional); `assetXe/baoGiaGet/Del`→idStr.
- [x] D9 typecheck + build từng module (tsc 0 err + build success, 27 routes).

## GĐ-F — Verify & Docs (sau mỗi GĐ lớn)
- [x] F1 `npm run typecheck` 0 err + `npm run build` success (27 routes).
- [x] F2 Rebuild container: host build xanh; `docker-compose.yml` đã sửa sẵn sàng — **override `DATABASE_URL` để container web không nhận chuỗi `${VAR}` hỏng** (env_file Docker không nội suy) + thêm volume ảnh chat `chat_imgs` + `CHAT_IMG_DIR=/app/chat_imgs` + `.dockerignore`. Lệnh chạy trên máy deploy: `cd Onpremise && bash scripts/deploy_local.sh`.
- [ ] F3 Smoke (trình duyệt): cần Docker + DB trên máy deploy — login→/home→/dashboard→/chat(gửi tin+ảnh)→/asset(quyết toán)→/baogia(tạo+sửa). Chưa chạy được tại chỗ (không có Docker/DB).
- [x] F4 `CHANGELOG.md` + `docs/ui_v4/09-CHECKLIST.md` (2.4✅/2.5❌ bỏ/tablet-lái xe comment) + `docs/ui_v4/04-SHELL.md` (2 link đã bỏ) + TASKS này.

## GĐ-G — UI/UX Pro Max Integration ✅
- [x] G1 Cài UI/UX Pro Max skill v2.13.0 vào `E:\DevTools\opencode\config\skills\ui-ux-pro-max\` (77 files: SKILL.md + data/ + scripts/ + references/).
- [x] G2 Đăng ký vào `SKILL_REGISTER.md` (GLOBAL scope).
- [x] G3 Chạy `check-skills.js` — ERR=0 WARN=0 / 13 skill.
- [x] G4 Generate Design System: `design-system/cencomos-gara/MASTER.md` (BM25 search "fleet management truck maintenance inventory SaaS dashboard").
- [x] G5 Review UI theo Pre-Delivery Checklist:
  - ✅ cursor-pointer: `.btn`, `a`, `.kb-card` đã có.
  - ✅ focus-visible: `globals.css:198-201` outline 2px.
  - ✅ prefers-reduced-motion: `globals.css:225` animation/transition = .001ms.
  - ✅ Responsive: 3 breakpoints (1024→68px, 768→hidden, 375→2col).
  - ✅ Loading states: forms đã có `disabled={loading}` + text change.
  - ✅ Semantic tokens: `@theme` + `@layer base` full CENCOM palette.
  - ✅ Error near-field: forms đã có error messages gần input (inline hoặc toast).
- [x] G6 Fix UX issues:
  - `--text-base` max: 15px → 16px (WCAG mobile, tránh iOS auto-zoom).
  - `body` line-height: thêm `1.5` (readability).
  - Thêm `SkipLink` component (`components/SkipLink.tsx`) + `sr-only`/`focus:not-sr-only` CSS utility trong globals.css.
  - Viết lại `MASTER.md` customize từ generated baseline → match CENCOM light theme.
  - Tạo 19 page-specific overrides trong `design-system/cencomos-gara/pages/` + 3 detail modal overrides (sc-detail, baogia-detail, kho-dm-detail).
  - Fix emoji Unicode (📎, ⚖, ➕, 🔄, ＋) → SVG icons trong buttons.
  - Accessibility audit: aria-label trên icon-only buttons, aria-hidden="true" trên nav icons, aria-label trên Sidebar links.
  - Thêm WebP image optimization guidelines vào MASTER.md.
- [x] G7 Verify: `tsc` 0 err + `npm run build` success (27 routes) + `check-skills.js` ERR=0.

## GĐ-H — Phase 2 Improvements (Hoàn thành)
- [x] H1 WebP conversion script: `scripts/convert-images.sh` (batch convert JPG/PNG → WebP via sharp CLI).
- [x] H2 Dark mode toggle: ThemeProvider + localStorage + CSS `.dark` vars + Topbar button + Sidebar CSS vars.
- [x] H3 CI token sync validator: `scripts/check-tokens.cjs` (CSS vars ↔ MASTER.md colors + typography + a11y checks).
- [x] H4 README.md: project-level documentation với UI/UX Pro Max, dark mode, scripts.
- [x] H5 Emoji fix: thay thế toàn bộ Unicode symbols (📎⚖➕🔄＋✕) bằng SVG icons trong 8 files.
- [x] H6 Sidebar accessibility: aria-label trên Links, aria-hidden="true" trên icon spans.
- [x] H7 MASTER.md: thêm dark mode color table + c-elevated + WebP guidelines.
- [x] H8 Verify: tsc 0 err + build 27 routes + check-skills ERR=0 + check-tokens ERR=0.
