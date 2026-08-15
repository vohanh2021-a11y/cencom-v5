# PLAN_UI_V4_15.08 — KẾ HOẠCH TỔNG THỂ TRIỂN KHAI GIAO DIỆN v4

> File master plan. Tích mục nhỏ thực thi xem `TASKS.md` (cùng thư mục).
> Tham chiếu thiết kế: `docs/ui_v4/00`→`09`. Đối chiếu: `docs/UI_DOI_CHIEU_TU_V3.md`.

## 0. MÔ TẢ & NGUYÊN TẮC
- **Mục tiêu**: Triển khai lại toàn bộ giao diện v4 trung thành 100% với `CencomOS-Garage-v3.6`, theo `docs/ui_v4/*`.
- **ĐÃ BỎ**: Tablet thợ + Cổng lái xe (hủy GĐ-E cổng; bỏ mục 2.5 Laixe + 2 link nav).
- **Tham chiếu bắt buộc**: `docs/ui_v4/00`→`09`; `docs/UI_DOI_CHIEU_TU_V3.md`; nguồn `CencomOS-Garage-v3.6/client/src/*`.
- **Quy tắc chung**:
  1. Clone-First / Copy 100% (verbatim tokens/CSS/JS, không "cải tiến").
  2. Không đổi core/contract — data qua `POST /api/rpc`.
  3. Tailwind **v4** (xác nhận) — `@import "tailwindcss"` + `@theme` trong `globals.css`; xóa `tailwind.config.ts`.
  4. Gatekeeper: RBAC gating, CSRF origin, no hardcode secret, async đầy đủ, try/catch.
  5. A11y: focus-visible ring, touch ≥44px, reduced-motion.
  6. Verify: `npm run typecheck` + `build` + rebuild container trước bàn giao.

## 1. CẤU TRÚC GIAI ĐOẠN
```
GĐ-A0  Nâng cấp Tailwind v3.4 → v4 + migration config
GĐ-A   Foundation: tokens / 8 components / ThemeProvider / Toast+Modal / keys scaffold
GĐ-B   Shell: Sidebar/Topbar/NotificationCenter + landing /home (RBAC, responsive)
GĐ-C   Home (Glass) + Dashboard (Bold: KPI/Kanban/timeline/thợ/báo cáo)
GĐ-D   Modules: SC / Kho / Chat / Asset / DeXuat / BaoGia / ThanhLy / Preview(2.4)
GĐ-F   Verify & Deploy: typecheck/build/rebuild/test + CHANGELOG + cập nhật docs/ui_v4
```
**Phụ thuộc**: A0→A→{B,C,D} (B/C/D độc lập, có thể song song). F sau mỗi GĐ lớn.

## 2. SONG SONG HÓA (không ghi đè file)
| Nhóm file | GĐ | Song song? |
|---|---|---|
| `globals.css`, `postcss.config.js`, xóa `tailwind.config.ts`, deps | A0+A1 | Đơn luồng (nền tảng) |
| `components/ui/*`, `ThemeProvider`, `ToastProvider`, `useGlobalKeys`, `CommandPalette` | A2-A5 | Cùng cây `components/` → liên tiếp trong A |
| `components/Sidebar,Topbar,NotificationCenter`, `(app)/layout.tsx` | B | **Song song với C/D** |
| `(app)/home`, `(app)/dashboard`, `KpiCard`, `Kanban*`, `VehicleCard`, `VehicleDetailModal` | C | **Song song với B/D** |
| `(app)/sc/*`, `kho/*`, `chat/*`, `asset/*`, `de-xuat/*`, `baogia/*`, `thanhly/*`, `preview/*` | D | 8 module cây riêng → **batch song song** |
| `tests/`, `CHANGELOG.md`, `docs/ui_v4/09`, `docs/ui_v4/04` | F | Cuối |

→ Thực thi: **A0→A** trước; sau đó **B ∥ C ∥ D** (D batch 8); mỗi cụm xong chạy **F** rút gọn.

## 3. CHI TIẾT TỪNG GĐ

### GĐ-A0 — Tailwind v3.4 → v4
- Deps: `tailwindcss@^4`, `@tailwindcss/postcss`; bỏ `autoprefixer`.
- `postcss.config.js`: `{ plugins: { '@tailwindcss/postcss': {} } }`.
- Xóa `apps/web/tailwind.config.ts`.
- `globals.css`: `@import "tailwindcss";` + `@theme { --color-primary:#0E5A37; ... }` + `@layer base{:root{...}}` + `@layer components{...}`.
- Verify `npm run build`.

### GĐ-A — Foundation (§01,02,03,07)
- A1. `globals.css`: `@layer base` tokens (§01) + `@layer components` (button/card/badge/skeleton/modal/toast §02, theme-home/dash/default §03). Xóa theme xanh dương `#2563eb`.
- A2. `components/ui/`: `Button`, `Card`, `Badge`, `Skeleton`, `Modal`(portal+ESC), `Toast`, `EmptyState`, `Table` (1-1 §02).
- A3. `ThemeProvider` (body class theo `usePathname` §03.4) + `ToastProvider`/`useToast` (1.5s §07.1).
- A4. `useGlobalKeys` (ESC order, ?, N, R, `isTyping` §07.1-7.3) + `CommandPalette.tsx` scaffold (§07.4).
- **DoD**: token CENCOM đủ, 8 component verbatim, 3 theme, Toast/Modal ESC ok, typecheck+build xanh.

### GĐ-B — Shell (§04, §07.4, §08)
- B1. `Sidebar` (Client): gradient CENCOM, logo "C", nav từ RBAC (`perms`), **bỏ 2 link Tablet/Lái xe**, ẩn admin/perm/preview non-admin.
- B2. `Topbar`: menu-btn, title, crumb, qrBtn/chPwBtn/logoutBtn (ẩn đến auth), whoChip, notifBtn+badge.
- B3. `NotificationCenter`: fixed `right:92px top:56px w:340px z:120`, badge từ `welcomeData()`+`useRealtime`.
- B4. Responsive: 240 / 68px tablet / drawer+mobile+scrim (§08).
- B5. Login redirect → `/home`.
- **DoD**: Shell chuẩn §04 (không 2 cổng), RBAC, notif, 3 breakpoint.

### GĐ-C — Home & Dashboard (§05, §06)
- C1. `Home` (Glass): banner, 5 KPI glass, Quick links, "Việc cần xử lý", "Vật tư sắp hết" (§05).
- C2. `Dashboard` (Bold): 8 KPI, Kanban 5 cột **1 xe=1 ô** (group BKS `dashboardAll`), VehicleCard, ETA badge, progress.
- C3. `VehicleDetailModal` (z1000): timeline 5 bước verbatim (§06.4-6.5).
- C4. Công việc theo thợ + Báo cáo chi phí (§06.6).
- C5. `useRealtime('sc')`+`('de_xuat_sua_chua')`.
- **DoD**: Home/Dashboard đúng §05/§06; đối chiếu 2.1/2.2/2.3 ✅.

### GĐ-D — Modules (§03 Calm, §08) — 8 subtask song song
- D1 SC · D2 Kho · D3 Chat · D4 Asset · D5 DeXuat · D6 BaoGia · D7 ThanhLy · D8 Preview (đối chiếu **2.4 ✅**).
- Mỗi module: list/detail theo token, RBAC, realtime.
- **DoD**: design system nhất quán, 2.4 ✅.

### GĐ-F — Verify & Deploy (sau mỗi GĐ lớn)
- F1. `npm run typecheck` (0 err) + `npm run build`.
- F2. Rebuild container: `npm run build` (host) + `docker compose up -d --build cencom-web`.
- F3. Smoke: login→/home→/dashboard→modules; Toast/ESC/Palette.
- F4. Cập nhật `CHANGELOG.md` + sửa `docs/ui_v4/09-CHECKLIST.md` (bỏ 2.5 + tablet/lái xe; 2.4→✅) + sửa `docs/ui_v4/04-SHELL.md` (bỏ 2 link).

## 4. CẬP NHẬT TÀI LIỆU THAM CHIẾU (trong F)
- `docs/ui_v4/09-CHECKLIST.md`: xóa 2.5 Laixe + dòng Tablet/Lái xe; 2.4 → ✅.
- `docs/ui_v4/04-SHELL.md`: bỏ 2 `<a>` Tablet/Lái xe.
- `docs/ui_v4/01` & `03`: đã đúng v4 (`@theme`), giữ nguyên.

## 5. RỦI RO
- ⚠️ Tailwind v4 migration (A0): đổi postcss, xóa config, `@apply` cũ vẫn ok; rollback giữ v3.4 nếu lỗi.
- ⚠️ `globals.css` đang xanh dương → ghi đè hoàn toàn.
- ⚠️ Supabase Realtime (`lib/use-realtime.ts`) tái dùng.
- ⚠️ Giữ `LogoutButton` Client Component (tránh 500 như GĐ9).
