# Kho (Inventory) Page Design Override

**Page:** `/kho`
**Theme:** Calm
**Priority:** Medium

## Layout

- Tab navigation: Tồn kho | Đề nghị mua | Phiếu nhập | Phiếu xuất
- Main: stock table with columns (code, name, unit, qty, warning threshold)
- Low stock: `var(--c-accent)` row highlight + warning icon
- Action FAB: + button for quick add

## Components

- `.tbl` table with sticky header
- Stock row hover: subtle green background
- Badge for tồn thấp: `badge-warn` with warning icon
- Modal forms: centered, slideUp animation

## Pre-Existing Notes

- `vatTuList` RPC for stock data
- `phNhapList` / `phXuatList` for history tabs
- `useRealtime('vattu')` for live updates
