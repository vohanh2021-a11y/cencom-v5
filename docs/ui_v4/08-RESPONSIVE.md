# 08 — RESPONSIVE & CẢM ỨNG (breakpoints · touch · reduced-motion)

> Verbatim media queries từ `theme-default.css` + notes từ `index.html` (dòng 276, 288) + `docs/CHANGELOG` v2/v3.

## 8.1 BREAKPOINTS (verbatim `theme-default.css`)
```css
.grid2, .kpis, .kb-cols { display: grid; gap: var(--sp-4); }
.grid2 { grid-template-columns: 1fr 1fr; }
.kpis { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.kb-cols { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); align-items: start; }
@media (max-width: 767px) {
  .grid2 { grid-template-columns: 1fr; }
  .kpis { grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); }
  .kb-cols { grid-template-columns: 1fr; }
  .theme-default .sc-row { padding: var(--sp-3); }
  .btn { min-height: 40px; }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .kpis { grid-template-columns: repeat(4, 1fr); }
}
```

## 8.2 SIDEBAR RESPONSIVE (từ `index.html` 276, 288)
- **Desktop (>1024px)**: sidebar `240px` cố định (gradient xanh đậm, logo + nav + foot).
- **Tablet (769–1024px)**: sidebar **thu gọn 68px chỉ icon** (ẩn label, giữ `🏠 ▦ 🔧…`).
- **Mobile (≤768px)**: sidebar thành **drawer** (`translateX(-102%)` → `.open` → `0`), mở bởi `menu-btn` (☰) trên topbar; `.scrim` overlay (`rgba(10,25,45,.5)`) click → `menuClose()`.

## 8.3 TOUCH / CẢM ỨNG
- Touch target tối thiểu **44px**: `.rate button` 44px, `.sel-cell` 42px, `.menu-btn` 42×42px, `.btn` mobile `min-height:40px`.
- `@media (pointer: coarse)`: tăng vùng chạm, giảm hover-dependent.
- ~~Tablet thợ (`tablet_insp.html`): dock bottom~~ — ĐÃ BỎ (quyết định GĐ-B: bỏ Tablet thợ + Cổng lái xe).
- **Swipe** chuyển tab: `touchstart`/`touchend`, `|dx|≥30 && >|dy|` → tab kế/trước.
- Mobile viewport: `maximum-scale=1, user-scalable=no` (chặn zoom browser trên tablet).

## 8.4 REDUCED MOTION
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
}
```
- Áp dụng cho mọi keyframes (shimmer, toastIn, viewFade, fadeIn, slideUp).

## 8.5 FLUID TYPOGRAPHY
- Body base `14px`; KPI Dash số `var(--text-3xl)` (~36px); tablet `16px`; lái xe `13px`.
- Mọi kích thước dùng `clamp()` (§01) → co giãn mượt theo viewport.

## 8.6 PORT (v4)
- Tailwind: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` tương đương media 768/1024.
- Sidebar: component nhận `useMediaQuery()` → `collapsed` (tablet) / `drawer` (mobile) / `fixed` (desktop).
- `Scrim` component (`fixed inset-0 bg-black/50`) khi drawer mở.
- `useSwipe()` hook cho chuyển tab trên mobile.
- Thêm `@media (prefers-reduced-motion)` global trong `globals.css`.

## 8.7 LƯU Ý
- Giữ nguyên 3 breakpoint (768 / 1024) — đồng bộ v3.6.
- Glass/Kanban phải render tốt ở mobile (1 cột).
- Touch 44px là yêu cầu accessibility (WCAG 2.1 target size).
