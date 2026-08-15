# De Xuat Detail Page Design Override

**Page:** `/de-xuat/[id]`
**Theme:** Calm
**Priority:** Medium

## Layout

- Detail modal (reuses list page with `deXuatGet`)
- Status badges at top
- Description + dấu hiệu field
- Action buttons: Duyệt / Từ chối / Tạo phiếu SC

## Components

- Modal with tab-like sections
- Action bar with conditional buttons based on status + RBAC

## Pre-Existing Notes

- `deXuatGet` returns full proposal data with items
- `deXuatApprove([id, action, lyDo])` positional
- `deXuatToSC(idStr)` creates SC
