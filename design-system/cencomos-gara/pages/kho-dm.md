# Kho DM (Purchase Request) Page Design Override

**Page:** `/kho/dm`
**Theme:** Calm
**Priority:** Medium

## Layout

- List of purchase requests with approval status
- Each row: supplier + amount + items count + status badge
- Action buttons: Chi tiết (modal), Duyệt/Từ chối
- Detail modal: full request details + decision form

## Color Overrides

- Status: awaiting → `badge-info`, approved → `badge-ok`, rejected → `badge-danger`
- Decision buttons: green (duyệt), red (từ chối)

## Pre-Existing Notes

- `dmList` RPC with status filter
- `dmDetail` modal with decision form
- `dmDecide` uses positional args `[id, action, lyDo]`
