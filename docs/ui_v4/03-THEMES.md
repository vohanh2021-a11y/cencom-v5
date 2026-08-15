# 03 — THEMES (verbatim từ `theme-home.css`, `theme-dash.css`, `theme-default.css`)

> 3 theme hybrid: **Glass (Home)** · **Bold (Dashboard)** · **Calm (tabs)**. Copy nguyên vẹn.
> Port: `ThemeProvider` set `<body class="theme-home|theme-dash|theme-default">` theo `usePathname()`.

## 3.1 GLASS — HOME (`theme-home.css`)
```css
.theme-home { background: linear-gradient(135deg, #0E5A37 0%, #14A05F 50%, #FFB703 100%); min-height: 100vh; }
.theme-home .card { background: rgba(255,255,255,0.08); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.15); color: white; }
.theme-home .card-hd { border-color: rgba(255,255,255,0.1); }
.theme-home .kpi { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); @apply rounded-xl p-4 text-center; transition: transform var(--transition-base); }
.theme-home .kpi:hover { transform: scale(1.05); background: rgba(255,255,255,0.15); }
.theme-home .quick { @apply rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium; background: rgba(255,255,255,0.1); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.12); color: white; transition: all var(--transition-base); }
.theme-home .quick:hover { background: rgba(255,255,255,0.18); transform: translateY(-2px); }
.theme-home .due { @apply rounded-lg px-4 py-3 mb-2; background: rgba(255,255,255,0.08); border-left: 3px solid var(--c-accent-light); }
.theme-home .btn-primary { background: rgba(255,255,255,0.2); @apply text-white; backdrop-filter: blur(8px); }
.theme-home a:not(.quick) { color: rgba(255,255,255,0.9); }
.theme-home a:not(.quick):hover { color: white; text-decoration: underline; }
/* readability trong card glass */
.theme-home .card .hd h2 { color: rgba(255,255,255,.95); }
.theme-home .card .muted { color: rgba(255,255,255,.7); }
.theme-home .card table td, .theme-home .card table th { color: rgba(255,255,255,.92); border-bottom-color: rgba(255,255,255,.14); }
.theme-home .card .empty { color: rgba(255,255,255,.65); }
.theme-home .card .chip { background: rgba(255,255,255,.16); color: #fff; }
.theme-home .card .st { opacity: .95; }
.theme-home .card a:not(.quick) { color: #FFE1B3; }
/* Fallback: máy cũ không hỗ trợ backdrop-filter */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .theme-home .card, .theme-home .kpi, .theme-home .quick, .theme-home .due { background: rgba(11, 61, 41, 0.72); }
}
```

## 3.2 BOLD — DASHBOARD (`theme-dash.css`)
```css
.theme-dash { background: var(--c-bg); }
.theme-dash .kpi { @apply rounded-xl p-5 text-center relative overflow-hidden; background: linear-gradient(135deg, var(--c-primary), var(--c-primary-light)); color: white; box-shadow: 0 4px 20px rgba(14,90,55,0.3); transition: transform var(--transition-base), box-shadow var(--transition-base); }
.theme-dash .kpi:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 8px 30px rgba(14,90,55,0.4); }
.theme-dash .kpi::after { content: ''; @apply absolute inset-0 opacity-10; background: radial-gradient(circle at top right, white 0%, transparent 70%); }
.theme-dash .kpi .v { font-size: var(--text-3xl); font-weight: var(--fw-extrabold); line-height: 1; }
.theme-dash .kb-card { @apply rounded-xl p-4 mb-3 cursor-pointer; background: var(--c-surface); border-left: 4px solid var(--c-primary); box-shadow: var(--shadow-sm); transition: all var(--transition-base); }
.theme-dash .kb-card:hover { transform: translateY(-4px) rotate(-0.5deg); box-shadow: var(--shadow-lg); }
/* ETA badge */
.theme-dash .eta { @apply inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold; }
.theme-dash .eta-ok { @apply bg-green-100 text-green-700; }
.theme-dash .eta-today { @apply bg-yellow-100 text-yellow-700; }
.theme-dash .eta-late { @apply bg-red-100 text-red-700; }
/* Progress bar */
.theme-dash .progress { @apply h-2 rounded-full overflow-hidden; background: var(--c-line); }
.theme-dash .progress-fill { @apply h-full rounded-full; background: linear-gradient(90deg, var(--c-primary), var(--c-primary-lighter)); transition: width var(--transition-slow); }
/* Công việc theo thợ — avatar + progress (xem file gốc dòng 64–125) */
/* Báo cáo chi phí — gradient bar (xem file gốc dòng 127–154) */
/* Vehicle card + Timeline modal (xem 06-DASHBOARD) */
```

## 3.3 CALM — TABS (`theme-default.css`)
```css
.theme-default .sc-row { @apply rounded-xl p-4 mb-3; background: var(--c-surface); border: 1px solid var(--c-line); transition: all var(--transition-base); }
.theme-default .sc-row:hover { border-color: var(--c-primary-lighter); box-shadow: var(--shadow-sm); }
/* Accessibility focus ring */
:focus-visible { outline: 2px solid var(--c-primary-lighter); outline-offset: 2px; border-radius: var(--r-sm); }
.btn:focus-visible, .quick:focus-visible, a:focus-visible { outline: 2px solid var(--c-primary-lighter); outline-offset: 2px; }
.theme-home a:focus-visible, .theme-home .btn:focus-visible { outline-color: rgba(255,255,255,.9); }
.theme-dash .kpi:focus-visible { outline: 2px solid var(--c-accent-light); outline-offset: 3px; }
/* Calm tables */
.theme-default table.tbl thead th { letter-spacing: .04em; }
.theme-default .tbl tbody tr { transition: background var(--transition-fast); }
/* Responsive grids */
.grid2, .kpis, .kb-cols { display: grid; gap: var(--sp-4); }
.grid2 { grid-template-columns: 1fr 1fr; }
.kpis { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.kb-cols { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); align-items: start; }
@media (max-width: 767px) { .grid2 { grid-template-columns: 1fr; } .kpis { grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); } .kb-cols { grid-template-columns: 1fr; } .theme-default .sc-row { padding: var(--sp-3); } .btn { min-height: 40px; } }
@media (min-width: 768px) and (max-width: 1023px) { .kpis { grid-template-columns: repeat(4, 1fr); } }
/* Page transition */
#view { animation: viewFade .24s ease; }
@keyframes viewFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
/* Toast micro-interaction */
.toast { animation: toastIn .28s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes toastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
/* Card hover nhẹ */
.theme-default .kb-card:hover, .theme-default table.tbl tbody tr:hover { box-shadow: var(--shadow-md); }
/* Dashboard KPI số to + subtext */
.theme-dash .kpi .v { font-variant-numeric: tabular-nums; }
.theme-dash .kpi .s { font-size: var(--text-xs); opacity: .85; }
```

## 3.4 THEMEPROVIDER (port)
```tsx
'use client';
import { usePathname } from 'next/navigation';
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const theme = path === '/home' ? 'theme-home'
              : path === '/dashboard' ? 'theme-dash'
              : 'theme-default';
  return <body className={theme}>{children}</body>; // hoặc div wrapper bao app
}
```

## 3.5 LƯU Ý
- Giữ đúng gradient Glass (135deg xanh→cam) và gradient Bold KPI (primary→primary-light + shadow xanh).
- `@supports not (backdrop-filter)` fallback bắt buộc (máy cũ).
- Hover micro-interactions: Home `scale(1.05)`, Dash `translateY(-4px) scale(1.02)` / `rotate(-.5deg)`.
