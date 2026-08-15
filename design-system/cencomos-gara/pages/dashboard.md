# Dashboard Page Design Override

**Page:** `/dashboard`
**Theme:** Bold
**Priority:** High

## Color Overrides

| Element | Variable | Value |
|---------|----------|-------|
| Page background | `background` | `var(--c-bg)` (cream) |
| KPI card | `.kpi` | Gradient green `linear-gradient(135deg, var(--c-primary), var(--c-primary-light))`, white text |
| Kanban card | `.kb-card` | White surface, left accent stripe |
| Progress bar | `.progress-fill` | Gradient green→amber |

## Layout Rules

- KPI cards: gradient green background, `extrabold` numbers, `tabular-nums`, relative overflow-hidden (radial glow overlay)
- Kanban: 5 columns (ToDo → Doing → Checking → Done), vertical scroll within columns
- Vehicle cards: BKS bold + status badges, 3-column desktop grid
- Timeline view: 5-step horizontal timeline with dots (✅ done, ⚠️ eta, gray pending)
- Technician cards: avatar + progress bar + count

## Typography

- KPI value: `var(--text-3xl)` extrabold white
- KPI label: `var(--text-xs)` white, 85% opacity
- Kanban card title: `var(--text-sm)` semidold
- Technician name: `var(--text-sm)` bold

## Animation

- KPI hover: translateY(-4px) + scale(1.02), shadow-xl
- Card hover: translateY(-2px), 200ms ease
- Timeline dot: green for done, amber for eta, gray pending

## Pre-Existing Notes

- `useRealtime('sc')` + `('de_xuat_sua_chua')` for live updates
- `font-variant-numeric: tabular-nums` on KPI values
- Technician avatar: gradient green background
