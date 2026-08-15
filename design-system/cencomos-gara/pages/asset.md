# Asset Page Design Override

**Page:** `/asset`
**Theme:** Calm (white cards, subtle)
**Priority:** Medium (reporting)

## Layout

- Tabs: Báo cáo tài sản | Tra cứu xe | Lịch sử
- Report cards: grid of asset KPIs with gradient headers
- Search: BKS input + date range picker
- Results: table or card results

## Color Overrides

- Report card headers: gradient green
- Asset badges: semantic colors (ok/in_progress/warning)
- Search filter: standard `.input` + date picker

## Components

- `.card-bold` for report cards (hover lift)
- `.tbl` for results table
- Date range: two `.input` date fields
- Action buttons: small primary for "Quyết toán"

## Pre-Existing Notes

- `assetReport`, `assetXe(idStr)`, `lichSuaList`
- `quyetToan` gated by RBAC `asset.quyet`
- `asset.xem` for viewing
