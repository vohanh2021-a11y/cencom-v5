# Kho Xuất (Stock Out) Page Design Override

**Page:** `/kho/xuat`
**Theme:** Calm
**Priority:** Medium

## Layout

- List of stock-out slips (xuất kho)
- Each row: purpose (SC/Bảo trì) + date + operator + status
- Create: dropdown vật tự + quantity

## Components

- `.tbl` table with hover rows
- Create modal: link to SC if purpose = repair

## Pre-Existing Notes

- `phXuatList` / `phXuatCreate` RPC
- `useRealtime('phieu_xuat')` for updates
- SC items show link to `/sc/[id]`
