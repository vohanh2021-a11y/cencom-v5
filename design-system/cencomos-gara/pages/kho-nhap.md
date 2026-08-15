# Kho Nhập (Purchase Receipt) Page Design Override

**Page:** `/kho/nhap`
**Theme:** Calm
**Priority:** Medium

## Layout

- List of purchase receipts
- Each row: supplier + date + total + status
- Create receipt: form with vật tư dropdown + quantity

## Components

- `.tbl` table with hover rows
- Create modal: dropdown vật tư, number input số lượng
- Status badges: created → info, approved → ok

## Pre-Existing Notes

- `phNhapList` / `phNhapCreate` RPC
- `useRealtime('phieu_nhap')` for updates
- Items link to `vatTuList` for dropdown
