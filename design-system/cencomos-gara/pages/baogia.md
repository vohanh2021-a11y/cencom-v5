# BaoGia (Quote) Page Design Override

**Page:** `/baogia`
**Theme:** Calm
**Priority:** Medium (commercial)

## Layout

- Quotes list: table with BKS, services summary, total, status
- Each row: status badge + actions (chi tiết, xóa, sửa)
- Create quote: form from SC, auto-fill dịch vụ/vật tư
- Confirm: modal with item editing

## Color Overrides

- Status: draft → neutral, confirmed → ok
- Item rows: alternate subtle background

## Components

- `.tbl` table with action buttons per row
- Create modal: linked SC, dynamic service items
- Confirm modal: editable item table (price, quantity, discount)

## Pre-Existing Notes

- `baoGiaList`, `baoGiaCreate`, `baoGiaGet(idStr)`, `baoGiaDel(idStr)`
- `baoGiaConfirm([id, rec])` positional (positional args, object rec)
- Contract fixed: `ncc`→`ncc_ten`, `sl`→`so_luong`
- RBAC: `mua` permission
