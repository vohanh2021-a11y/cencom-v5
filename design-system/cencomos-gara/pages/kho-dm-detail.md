# Kho DM Detail Modal Page Design Override

**Page:** `/kho/dm` (detail modal)
**Theme:** Calm
**Priority:** Medium

## Layout

- Modal triggered from "Chi tiết" button
- Header: đề nghị mua ID + status badge
- Body: supplier info, items table with vattu references
- Decision section: Duyệt/Từ chỗi buttons + lyDo input (conditional)

## Components

- Items table: vattu name + quantity + price
- Status badge: pending (info), approved (ok), rejected (danger)
- Decision buttons: green/red with loading state
- Reject reason: textarea in modal

## Pre-Existing Notes

- `dmDetail([id])` — id arg
- `dmDecide([id, action, lyDo])` — positional args
- `dmList` for parent list
