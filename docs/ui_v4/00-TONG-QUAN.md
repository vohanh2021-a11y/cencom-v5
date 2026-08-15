# 00 — TỔNG QUAN TÀI LIỆU THAM CHIẾU UI v4 (từ v3.x)

> Mục đích: cung cấp **bản tham chiếu thiết kế giao diện 100% faithful** từ phần mềm gốc
> (`CencomOS-Garage-v3.6`) để triển khai lại giao diện cho `cencomOS_gara_4.0_supa` (Next.js + Tailwind v4).
> Mọi thông số màu, khoảng cách, bóng, hover, keyframes, phím tắt đều được **copy nguyên vẹn (verbatim)**
> từ source gốc — không tự ý "cải tiến" (nguyên tắc Clone-First: preserve, don't improve).

## 1. NGUYÊN TẮC
- **Clone-First (global §8)**: tái dùng tokens/CSS gốc → Tailwind `@layer` trong v4.
- **Giữ backend/core + contract**: mọi view React gọi `POST /api/rpc {fn,args}` (KHÔNG đổi logic nghiệp vụ).
- **Không đổi business logic**: chỉ đổi công nghệ trình bày (Vanilla JS `gd3.js` → React component).
- **Typography/Spacing**: dùng `--text-*` (clamp fluid) và `--sp-*` (4px base) nguyên bản.

## 2. NGUỒN THAM CHIẾU (Source of Truth)
| Nội dung | File gốc (verbatim) |
|---|---|
| Design tokens (màu, spacing, font, shadow, glass) | `CencomOS-Garage-v3.6/client/src/tokens.css` |
| 3 themes (Glass / Bold / Calm) | `client/src/theme-home.css`, `theme-dash.css`, `theme-default.css` |
| 8 components (button, card, badge, skeleton, modal, toast, empty, table) | `client/src/components/*.css` |
| Shell (sidebar/topbar/notification) | `client/index.html` (dòng 408–477) |
| Home (Trang chủ) | `client/index.html` + `gd3.js` `drawNotif` |
| Dashboard (Kanban + timeline xe) | `gd3.js` dòng 460–583 (`renderKanban`, `openVehicleDetail`) |
| Phím tắt / Palette / ESC | `index.html` dòng 1711–1739 + `gd3.js` dòng 3470–3560 |
| Spec thiết kế v3.8 | `CencomOS-Garage-v3.6/docs/PLAN_V3.8_UI.md` |
| Checklist đối chiếu | `cencomOS_gara_4.0_supa/docs/UI_DOI_CHIEU_TU_V3.md` |

## 3. CÔNG NGHỆ MAP (v3.6 → v4)
| v3.6 (Vanilla) | v4 (React/Tailwind v4) |
|---|---|
| `@layer base/components` CSS | `app/globals.css` (Tailwind v4 `@theme`/`@layer`) |
| `class="theme-home"` trên `<body>` | `ThemeProvider` dùng `usePathname()` → set class lên `<body>` |
| `gd3.js` render string HTML | React component + `useRealtime` + `POST /api/rpc` |
| `formModal()` / `modal()` global | `<Modal>` component (portal) |
| `toast()` / `toastHide()` | `<ToastProvider>` context |
| `detectDevice()` + media query | Tailwind responsive classes + `useMediaQuery` |

## 4. PHẠM VI TRIỂN KHAI (đợt 1)
- **GĐ-A — Foundation**: tokens, 8 components, ThemeProvider, ToastProvider, Modal, globals.css.
- **GĐ-B — Shell**: Sidebar (RBAC gating), Topbar, NotificationCenter, landing `/home`.
- **GĐ-C — Home + Dashboard**: Trang chủ (Glass) + Bảng điều khiển (Bold, Kanban, timeline xe).
- **Đợt 2 (GĐ-D…)**: SC list/detail, Kho, Chat, Asset, Preview. *(Tablet thợ & Cổng lái xe: ĐÃ BỎ theo quyết định GĐ-B)*

## 5. CẤU TRÚC FOLDER NÀY
```
docs/ui_v4/
  00-TONG-QUAN.md      — bản này
  01-DESIGN-TOKENS.md  — tokens.css verbatim + chỗ đặt trong v4
  02-COMPONENTS.md     — 8 component CSS verbatim + port
  03-THEMES.md         — 3 theme CSS verbatim + ThemeProvider
  04-SHELL.md          — sidebar/topbar HTML + gating + notif
  05-HOME.md           — Trang chủ Glass
  06-DASHBOARD.md      — Bảng điều khiển Bold + Kanban + timeline
  07-INTERACTIONS.md   — phím tắt / palette / ESC / hover
  08-RESPONSIVE.md     — breakpoint / touch / reduced-motion
  09-CHECKLIST.md      — copy-100% checklist + đối chiếu UI_DOI_CHIEU
```
