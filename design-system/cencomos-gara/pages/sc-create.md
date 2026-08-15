# Service Center Create Page Design Override

**Page:** `/sc/create`
**Theme:** Calm
**Priority:** High (form)

## Layout

- Sticky action bar: "Tạo phiếu" + "Hủy" buttons at bottom of scroll
- Form sections: Thông tin xe + Công việc (dynamic) + Vật tư (dynamic)
- Công việc rows: add/remove with +/− buttons, auto-fill from dịch vụ
- Vật tư rows: add/remove, dropdown từ kho

## Components

- Form inputs: standard `.input` with label
- Dynamic rows: table-like layout, remove button on each row
- Add button: small accent button
- Submit: primary gradient button, loading state

## Pre-Existing Notes

- Công việc/vật tư được thêm động qua form
- BKS input có autocomplete từ danh sách xe
- `scCreate` RPC receives full object including arrays
