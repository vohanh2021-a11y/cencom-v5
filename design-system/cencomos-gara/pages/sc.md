# Service Center List Page Design Override

**Page:** `/sc`
**Theme:** Calm
**Priority:** High (core workflow)

## Layout

- Filter bar: status dropdown + BKS search input (sticky top)
- SC list: `.sc-row` cards — white surface, rounded-xl, border, shadow-sm
- Each row: BKS + status badge + timeline + actions
- Empty state: centered icon + message

## Typography

- BKS: `var(--text-base)` bold (700)
- Status badge: `var(--text-xs)` uppercase, full rounded
- Row info: `var(--text-sm)` regular
- Timestamps: `var(--text-xs)` muted

## Color Overrides

- `.sc-row`: white surface, border `var(--c-line)`, border-radius `var(--r-xl)`
- `.sc-row:hover`: border-color `var(--c-primary-lighter)`, shadow-sm
- Status badges: use semantic colors (ok/warn/danger/info)
- Low stock items: `var(--c-accent)` highlight

## Components

- Filter inputs: standard `.input` style
- Status dropdown: custom select with caret
- Action buttons: small, ghost variant

## Pre-Existing Notes

- `useRealtime('sc')` for live updates
- `scList` RPC with `[status, bks_filter]` args
- Each row links to `/sc/[id]`
