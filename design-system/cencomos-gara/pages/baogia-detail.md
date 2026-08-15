# BaoGia Detail Modal Page Design Override

**Page:** `/baogia` (detail modal)
**Theme:** Calm
**Priority:** Medium

## Layout

- Modal triggered from table row "Xem" button
- Header: chứng từ ID + type badge (Báo giá / Hóa đơn)
- Body: supplier info, SC reference, items table, totals
- Edit mode: editable fields + save/cancel
- Confirm mode: full item editing (price, qty, discount)

## Components

- Modal with slideUp animation
- Items table with editable cells in confirm mode
- Status badge: draft (neutral), confirmed (ok)
- Action buttons: Sửa, Xác nhận, Đóng

## Pre-Existing Notes

- `baoGiaGet(idStr)` — id string
- `baoGiaConfirm([id, rec])` — positional args
- RBAC: `mua` permission for edit/confirm
