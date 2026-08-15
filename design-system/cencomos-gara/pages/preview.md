# Preview Page Design Override

**Page:** `/preview`
**Theme:** Demo themes (simulates different user roles)
**Priority:** Low (demo only)

## Layout

- Role selector dropdown
- Preview sections show different UI per role:
  - Admin: full SC list + dashboard KPIs
  - Thợ: assigned work items
  - Kế toán: asset report + financials

## Pre-Existing Notes

- ADMIN ONLY access — RBAC gated
- `previewInfo/Home/SC/Kho/DM` positional `[role]`
- Pure client-side simulation, no real RPC data
