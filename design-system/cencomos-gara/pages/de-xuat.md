# De Xuat (Repair Proposal) Page Design Override

**Page:** `/de-xuat`
**Theme:** Calm
**Priority:** Medium (workflow)

## Layout

- List of proposals with status filter
- Each row: xe BKS + status badge + description + actions
- Create: form with xe selection, dịch vụ/vật tư dynamic

## Color Overrides

- Status: pending → info, approved → ok, rejected → danger, creating SC → warn
- Action buttons: primary/secondary/danger

## Components

- `.tbl` table with status badges
- Filter: status dropdown + BKS search
- Detail modal: full proposal + decision buttons
- Create form: same components as SC create

## Pre-Existing Notes

- `deXuatList`, `deXuatCreate`, `deXuatGet(idStr)`, `deXuatApprove([id, action, lyDo])`
- `deXuatToSC(idStr)` — create SC from proposal
- Contract fixed: `lydo`→`mo_ta` + `dau_hieu`
- `useRealtime('de_xuat_sua_chua')`
