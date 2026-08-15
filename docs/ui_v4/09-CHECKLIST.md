# 09 — CHECKLIST COPY-100% & ĐỐI CHIẾU

> Danh mục kiểm tra khi triển khai UI v4 từ tài liệu `docs/ui_v4/`. Mục tiêu: **copy 100%** giao diện gốc.

## 9.1 DESIGN TOKENS (§01)
- [ ] `--c-primary:#0E5A37`, `--c-accent:#F28C1D` + toàn bộ palette verbatim.
- [ ] Spacing `--sp-1..12` (4px base), Typography clamp, Radius, Shadows, Glass, Transitions.
- [ ] Đặt trong `@theme` + `@layer base :root` (giữ raw cho CSS cũ).

## 9.2 COMPONENTS (§02)
- [ ] Button (primary/accent/ghost/danger, sm/md/lg, hover translateY(-1px)).
- [ ] Card (default/glass/bold, hover translateY(-4px) bold).
- [ ] Badge (ok/warn/danger/info/neutral + KB blue/purple/orange sm).
- [ ] Skeleton (shimmer 1.5s, text/card/table/circle).
- [ ] Modal (fadeIn 200ms + slideUp 300ms, overlay blur4 + rgba(.5)).
- [ ] Toast (slide-x, max-width 360px, top/right 20px, z 9999).
- [ ] Empty / Table (hover row primary-subtle).

## 9.3 THEMES (§03)
- [ ] Glass (Home): gradient 135deg xanh→cam, card glass blur16, kpi glass scale(1.05), fallback `@supports`.
- [ ] Bold (Dash): KPI gradient + shadow xanh + hover lift, kb-card border-left 4px + rotate(-.5deg), eta ok/today/late, progress gradient.
- [ ] Calm (tabs): sc-row hover, focus-visible ring, viewFade, toastIn, responsive grids.

## 9.4 SHELL (§04)
- [ ] Sidebar 240px + nav RBAC (ẩn admin/perm/preview với non-admin) + logo "C".
- [ ] Topbar: menu-btn, pageTitle, crumb, qrBtn/chPwBtn/logoutBtn (ẩn đến khi auth), whoChip, notifBtn+badge.
- [ ] NotificationCenter (fixed right:92px top:56px width:340px z:120) + badge tổng hợp.
- [ ] LogoutButton là Client Component (tránh 500 như GĐ9).

## 9.5 HOME (§05)
- [ ] Banner glass chào mừng + 5 KPI glass + Quick links + "Việc cần xử lý" (.due) + "Vật tư sắp hết" (table glass).
- [ ] Landing sau login = `/home` (đổi redirect từ `/dashboard`).

## 9.6 DASHBOARD (§06)
- [ ] 8 KPI ô gradient Bold + hover lift.
- [ ] Kanban 5 cột (de_xuat/da_duyet/dang_sua/cho_nghiem/tu_choi) — **1 xe = 1 ô** (group BKS).
- [ ] VehicleCard: bks 15px/700, scLabel, badges sm (blue/purple/orange), progress bar, ETA (ok/today/late), tho_chinh.
- [ ] Timeline modal (`vhdModal` z1000): 5 bước (Lập/Duyệt/Bắt đầu/Hẹn trả/Nghiệm thu), dot done xanh / eta vàng / chưa xám.
- [ ] Công việc theo thợ (avatar gradient + progress ring) + Báo cáo chi phí (bar gradient trong/ngoài).

## 9.7 INTERACTIONS (§07)
- [ ] Ctrl/Cmd+K → Command Palette (debounce 180ms, arrow nav, Enter go+detail, click ngoài đóng).
- [ ] `isTyping()` guard (INPUT/TEXTAREA/SELECT) cho N/R/?/Esc.
- [ ] Esc thứ tự: toast → vhdModal → clModal.
- [ ] `?` help sheet, `N` (CUR==='sc'), `R` (refresh current).
- [ ] Hover micro-interactions (btn/kpi/kb-card/tho) verbatim.

## 9.8 RESPONSIVE (§08)
- [ ] Breakpoints 768/1024; sidebar 240 / 68px icon / drawer + scrim.
- [ ] Touch ≥44px; swipe chuyển tab; maximum-scale=1 tablet.
- [ ] Reduced-motion media query.
- [ ] Fluid typography clamp.

## 9.9 ĐỐI CHIẾU `docs/UI_DOI_CHIEU_TU_V3.md`
| Mục | Yêu cầu | Trạng thái plan |
|---|---|---|
| 2.1 Toast | Tự ẩn 1.5s, click/✕/ESC đóng | ✅ §02.6 + §07.1 |
| 2.2 ESC | Đóng đúng thứ tự overlay | ✅ §07.1 |
| 2.3 Kanban | 1 xe=1 ô, 5 cột, ETA, timeline | ✅ §06 |
| 2.4 Role Preview | Demo theo vai (permission matrix) | ✅ GĐ-B (route `/preview`, RBAC admin) |
| 2.5 Laixe | Bỏ mustChange, cổng riêng | ❌ ĐÃ BỎ (quyết định GĐ-B: bỏ Tablet thợ + Cổng lái xe) |

## 9.10 LƯU Ý
- Mọi item chưa ✅ = chưa làm trong đợt 1 (GĐ-A→C). Đợt 2 sẽ bổ sung đầy đủ.
- Khi implement, đối chiếu verbatim CSS trong từng file § tương ứng — **không tự ý đổi giá trị**.
- **Trạng thái GĐ-D (2026-08-15)**: 8 module đã implement + RBAC + realtime, build xanh (27 routes):
  D1 `/sc` (list+detail+create+action bar), D2 `/kho` (vattu/dm/nhap/xuat), D3 `/chat` (chatList/Peers/Send/Img/Delete + realtime), D4 `/asset` (báo cáo+tra cứu+quyết toán), D5 `/de-xuat` (list+detail+duyệt+tạo SC), D6 `/baogia` (list+create+detail+xóa), D7 `/thanhly` (list), D8 `/preview` (demo 7 vai, admin). Hợp đồng Zod SC/Kho/DeXuat/Asset/BaoGia/NhanKy/Chat đã sửa khớp core. Core logic test: **134/134 PASS**.
