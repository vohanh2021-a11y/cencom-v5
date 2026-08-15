# Home Page Design Override

**Page:** `/home`
**Theme:** Glass
**Priority:** High

## Color Overrides

| Element | Variable | Value |
|---------|----------|-------|
| Page background | `background` | `linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-lighter) 50%, var(--c-accent-light) 100%)` |
| Card background | `.card` | `rgba(255,255,255,0.08)` + `backdrop-filter: blur(16px)` |
| KPI card hover | `.kpi:hover` | Scale 1.05 + opacity increase |

## Layout Rules

- KPI cards: glass background, `backdrop-filter: blur(12px)`, 4-column grid on desktop
- Quick pills: glass background, icon + label, hover translateY(-2px)
- Due items: left accent stripe `var(--c-accent-light)`, glass background
- Banner: full-width gradient card with CENCOM mark

## Typography

- Banner title: `var(--text-2xl)` semibold, white
- KPI value: `var(--text-2xl)` extrabold, white
- KPI label: `var(--text-xs)` uppercase, `rgba(255,255,255,0.7)`
- Card heading: `rgba(255,255,255,0.95)`

## Components

- All cards: `rounded-xl`, glass effect
- All links: `rgba(255,255,255,0.9)` → white on hover
- Empty state: `rgba(255,255,255,0.65)`

## Pre-Existing Notes

- Responsive: 2-column KPI grid on mobile, 4-column on tablet/desktop
- Backdrop-filter support checked (fallback: `rgba(11,61,41,0.72)`)
