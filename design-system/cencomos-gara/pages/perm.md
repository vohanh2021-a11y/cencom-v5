# Permission Matrix Page Design Override

**Page:** `/perm`
**Theme:** Calm
**Priority:** Medium (admin tool)

## Layout

- Full-width permission matrix table
- Columns: Role | Module.Permission checkboxes
- Rows: each role + permissions for SC, Kho, Chat, Asset, BaoGia, DeXuat

## Components

- `.tbl` table with hover rows
- Checkbox inputs in matrix cells
- Save button: fixed at bottom with loading state

## Color Overrides

- Header row: `var(--c-primary-subtle)` background
- Checked checkboxes: `var(--c-primary)`
- Hover: subtle row highlight

## Pre-Existing Notes

- `permList`, `permSave` RPC
- RBAC: admin only
- Full page load (no realtime needed)
