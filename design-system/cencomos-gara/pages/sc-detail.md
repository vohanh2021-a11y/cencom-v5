# SC Detail Modal Page Design Override

**Page:** `/sc/[id]`
**Theme:** Calm
**Priority:** High (workflow detail)

## Layout

- Topbar: "Chi tiết phiếu #SC-XXX" + breadcrumb
- Action bar (conditional): buttons based on trang_thái + quyền (RBAC gated)
- Tab sections: Thông tin xe | Công việc | Vật tư | Lịch sử
- Status timeline: horizontal stepper showing 5 states (xemxet → cho_duyet → dang_lam → hoan_thanh → nghiem_thu → da_duyet)

## Color Overrides

- Action buttons:
  - Duyệt: primary green
  - Từ chối: danger red
  - Tổng duyệt: accent
  - Từ chối tổng duyệt: danger
  - Bắt đầu sửa: accent
  - Hoàn tành: accent
  - Nghiệm thu đạt: ok green
  - Nghiệm thu không đạt: danger

## Components

- Modal overlay: `rgba(0,0,0,0.35)` backdrop + blur
- Timeline: 5-step horizontal with dots (green=done, amber=eta, gray=pending)
- Action bar: conditional buttons, disabled={busy} during async
- Reject modal: separate modal with lyDo textarea

## Pre-Existing Notes

- `scGet` RPC returns full detail data
- Actions use `act(fn, args, toastMsg)` pattern — positional args `[id]` hoặc `[id, action, lyDo]`
- RBAC gating trong component (perms check)
- Realtime refetch after actions
