# ThanhLy (Disposal) Page Design Override

**Page:** `/thanhly`
**Theme:** Calm
**Priority:** Low

## Layout

- Search box for SC filter
- Disposal items table: SC info + items + quantities
- Each row links to SC detail

## Components

- Search input at top
- `.tbl` table with SC link in BKS column
- Loading state: skeleton table rows

## Pre-Existing Notes

- `thanhLyList([q])` — positional args, SC query
- RBAC: `kho.xem`
- Simple read-only list
