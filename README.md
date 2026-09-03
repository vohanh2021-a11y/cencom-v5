# CencomOS v4.0 — UI/UX Pro Max Integration

> Hệ thống quản lý & giám sát xe đầu kéo — bản cloud v4.0 (Next.js + TypeScript + Tailwind v4 + Supabase)

## 🎨 UI/UX Pro Max

Dự án tích hợp **UI/UX Pro Max v2.13.0** (tác giả viettranx / NextLevelBuilder, MIT) — một skill thiết kế local không có server, cung cấp:
- 79 UI styles (50 đang hoạt động)
- 192 product palettes + reasoning profiles
- 74 font pairings
- 119 UX guidelines
- 105 curated icons
- 25 chart types
- 22 technology stacks

### Cài đặt (đã hoàn thành)
```bash
# Skill đã được cài ở:
E:\DevTools\opencode\config\skills\ui-ux-pro-max\

# Để sử dụng:
# - Tìm styles: python scripts/search.py "query" --domain style
# - Tạo design system: python scripts/search.py "query" --design-system --persist -p "Project"
```

### Design System
- **Master file:** `design-system/cencomos-gara/MASTER.md` — chứa toàn bộ tokens, themes, components
- **Page overrides:** `design-system/cencomos-gara/pages/` — 22 files override cho từng route
  - 19 route chính + 3 modal detail (sc-detail, baogia-detail, kho-dm-detail)

### Scripts hữu ích
```bash
# Kiểm tra token sync (CSS ↔ Master)
node scripts/check-tokens.cjs

# Chuyển đổi hình ảnh sang WebP
bash scripts/convert-images.sh [quality]  # default: 85

# Chạy toàn bộ kiểm tra
npx tsc --noEmit                    # Type check
npm run build                       # Build Next.js
node "E:\DevTools\opencode\config\check-skills.js"  # Kiểm tra skills
node scripts/check-tokens.cjs       # Kiểm tra tokens
cd packages/core && npm test         # Core logic tests (134/134)
```

## 🌓 Dark Mode

Đã triển khai dark mode toggle trong Topbar:
- Toggle lưu preference trong `localStorage.theme`
- Tự động phát hiện `prefers-color-scheme: dark`
- CSS variables override qua `.dark` class trên `<html>`

## 🦯 Accessibility

Các cải tiến đã thực hiện:
- **Skip-link**: `components/SkipLink.tsx` (hiện lên khi Tab, nhảy đến #main-content)
- **Focus states**: `focus-visible` outline 2px trên tất cả interactive elements
- **ARIA labels**: Thêm vào icon-only buttons và Sidebar nav
- **prefers-reduced-motion**: Animation/transition = 0.001ms khi bật
- **Keyboard navigation**: Tab order tuần tự, Esc đóng modals/notifications
- **SVG icons**: Thay thế tất cả emoji Unicode bằng SVG (paperclip, refresh, plus, close, scales)

## 📏 Design Tokens (CENCOM)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | `#0E5A37` | `#14A05F` | Brand green |
| Accent | `#F28C1D` | `#FFB703` | CTA buttons |
| Background | `#FBF6EE` | `#0F172A` | Page bg |
| Surface | `#FFFFFF` | `#1E293B` | Cards |
| Ink | `#26372C` | `#F8FAFC` | Text |

Typography: Inter, base 16px (clamp max), line-height 1.5.

## 🚀 Quick Start

```bash
# Dev
cd apps/web && npm run dev

# Build + Deploy (on-premise)
cd Onpremise && bash scripts/deploy_local.sh
```

## 📹 UX Demo Video & Audit

Video demo vận hành xuyên suốt (login → home → dashboard → SC → Kho → Chat → Asset → Báo giá → Đề xuất → Phân quyền → Thanh lý → Dark mode → Mobile):

- **`videos/cencom-ux-tour-2026-08-15.webm`** (54s, 2.3MB) — bản gốc
- **`videos/cencom-ux-tour-2026-08-15.mp4`** (0.9MB) — bản compat
- **`videos/frames/*.png`** — 14 frames để review nhanh

Quy trình audit (skill `ux-video-audit`): quay bằng Playwright `recordVideo`, sau đó đánh giá tự động DOM/console/RPC.

Scripts liên quan:
```bash
node scripts/seed-demo-data.mjs   # sinh dữ liệu demo (idempotent)
node scripts/record-ux.mjs        # quay video full-tour
pwsh scripts/run-ux-audit.ps1     # orchestration (postgres + dev + record)
node scripts/eval-ux.mjs          # kiểm tra overflow/console/dark/mobile
node scripts/rpc-all.mjs          # audit 95 RPC handlers (tìm handler thiếu)
node scripts/verify-ui.mjs        # xác minh dark mode + mobile drawer
```

> ⚠️ Video ghi nhận app SAU KHI fix critical RPC dispatch (data load được). Chi tiết fix xem `CHANGELOG.md` mục **2026-08-16 — UX VIDEO AUDIT + CRITICAL RPC DISPATCH FIX**.
