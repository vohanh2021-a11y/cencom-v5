# 06 — DASHBOARD (Bảng điều khiển · Bold theme)

> Theme: `theme-dash` (xem 03). Port: `apps/web/app/(app)/dashboard/page.tsx`.
> Core: `packages/core/src/xuong.ts` → `dashboardAll()` (đã port). Dữ liệu: 5 cột Kanban, group theo BKS, `baocao_thang`.

## 6.1 BỐ CỤC
- **Toolbar**: `🔄 Làm mới` (R) + `📊 Tổng hợp NC ngoài`.
- **8 KPI ô** (`.kpis` auto-fit): gradient primary, số `text-3xl extrabold tabular-nums`, hover `translateY(-4px) scale(1.02)`, `::after` radial highlight.
- **Kanban 5 cột** (`.kb-cols`): `de_xuat` / `da_duyet` / `dang_sua` / `cho_nghiem` / `tu_choi`. Mỗi xe = 1 ô `.kb-card.vehicle-card` (group SC cùng BKS).
- **Timeline modal** (`openVehicleDetail`): bấm card → modal hồ sơ xe (5 bước). Xem §6.4.
- **Công việc theo thợ** (`.kb-tho`): avatar gradient + progress ring + số việc.
- **Báo cáo chi phí tháng** (`.bc-row`): bar gradient trong/ngoài.

## 6.2 KANBAN CARD RENDER (verbatim `gd3.js` 460–496)
```js
var eta = '';
if (c.eta && c.eta.ngay) {
  var cls = 'ok', lbl = 'Hẹn ' + c.eta.ngay;
  if (c.eta.con < 0) { cls = 'over'; lbl = 'Trễ ' + Math.abs(c.eta.con) + ' ngày'; }
  else if (c.eta.con === 0) { cls = 'warn'; lbl = 'Hẹn hôm nay'; }
  eta = '<div class="eta-set"><span class="kb-eta ' + cls + '">⏰ ' + esc(lbl) + '</span></div>';
}
var bar = (c.phan_tram || 0) > 0
  ? '<div class="kb-bar"><i style="width:' + Math.min(100, c.phan_tram) + '%"></i></div>' : '';
var badges = '';
if (c.sc_count > 1) {
  var parts = [];
  if (c.sc_dang_sua) parts.push('<span class="badge sm blue">🔧 ' + c.sc_dang_sua + ' đang sửa</span>');
  if (c.sc_cho_nghiem) parts.push('<span class="badge sm purple">📋 ' + c.sc_cho_nghiem + ' chờ nghiệm</span>');
  if (c.sc_cho_duyet) parts.push('<span class="badge sm orange">📝 ' + c.sc_cho_duyet + ' chờ duyệt</span>');
  badges = '<div class="kb-badges">' + parts.join(' ') + '</div>';
}
var scLabel = c.sc_count > 1
  ? '<span class="kb-sc-count">📋 ' + c.sc_count + ' phiếu SC</span>'
  : '<span class="kb-sc-count">📋 ' + esc(c.sc_ids[0]) + '</span>';
return '<div class="kb-card vehicle-card" onclick="openVehicleDetail(\'' + esc(c.bks) + '\')">' +
  '<div class="bks">' + esc(c.bks) +
    (c.hang ? ' <span class="muted" style="font-size:11px">' + esc(c.hang) + (c.nam_sx ? ' · ' + c.nam_sx : '') + '</span>' : '') +
  '</div>' +
  '<div class="meta" style="gap:6px;flex-wrap:wrap">' + scLabel +
    '<span class="ttl">' + esc(c.tong_tien_vnd) + '</span>' +
  '</div>' + badges + bar +
  '<div class="meta">' + (c.tho_chinh ? '<span>🔧 ' + esc(c.tho_chinh) + '</span>' : '') + '</div>' + eta +
'</div>';
```

## 6.3 VEHICLE CARD CSS (verbatim `theme-dash.css` 156–182)
```css
.theme-dash .vehicle-card .bks { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.theme-dash .kb-sc-count { font-size: 11.5px; color: var(--c-ink-muted); }
.theme-dash .kb-badges { display: flex; gap: 4px; flex-wrap: wrap; margin: 4px 0; }
.theme-dash .kb-badges .badge.sm { font-size: 10px; padding: 1px 6px; border-radius: 9999px; font-weight: 600; }
.theme-dash .kb-badges .badge.sm.blue { background: #E3F2FD; color: #1565C0; }
.theme-dash .kb-badges .badge.sm.purple { background: #F3E5F5; color: #7B1FA2; }
.theme-dash .kb-badges .badge.sm.orange { background: #FFF3E0; color: #E65100; }
```
- `.kb-eta.ok/.warn/.over` → map `.eta-ok/#10B981` (xanh), `.eta-today/#F59E0B` (vàng = warn/hôm nay), `.eta-late/#D64545` (đỏ = over/trễ).
- `.kb-bar i` = `.progress-fill` gradient.

## 6.4 TIMELINE MODAL — `openVehicleDetail(bks)` (verbatim `gd3.js` 504–583)
```js
function openVehicleDetail(bks) {
  var d = window._LAST_DASH_DATA || {};
  var cols = d.cols || []; var allCards = [];
  cols.forEach(function (col) { (col.cards || []).forEach(function (c) { allCards.push(c); }); });
  var vehicle = null;
  for (var i = 0; i < allCards.length; i++) { if (allCards[i].bks === bks) { vehicle = allCards[i]; break; } }
  if (!vehicle || !vehicle.sc_details || !vehicle.sc_details.length) return;
  var scs = vehicle.sc_details;
  var TT_LABEL = { de_xuat:'Đề xuất', da_duyet:'Đã duyệt', da_tong_duyet:'Đã tổng duyệt', dang_sua:'Đang sửa',
                   cho_nghiem:'Chờ nghiệm thu', da_hoan:'Đã hoàn', da_quyet:'Đã quyết toán', tu_choi:'Từ chối' };
  var TT_COLOR = { de_xuat:'#F26A1F', da_duyet:'#E8A33D', da_tong_duyet:'#5BA8D4', dang_sua:'#1D9E68',
                   cho_nghiem:'#7A4DF0', da_hoan:'#2ECC71', da_quyet:'#27AE60', tu_choi:'#E74C3C' };
  var html = '<div class="ovl" id="vhdModal" onclick="if(event.target===this)this.remove()">' +
    '<div style="background:#fff;border-radius:14px;padding:20px 24px;max-width:700px;width:95%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.18)">' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
      '<div style="font-size:20px;font-weight:700">' + esc(bks) + '</div>' +
      (vehicle.hang ? '<div class="muted" style="font-size:13px">' + esc(vehicle.hang) + (vehicle.nam_sx ? ' · ' + vehicle.nam_sx : '') + '</div>' : '') +
      '<div class="grow"></div>' +
      '<span style="font-size:13px;color:#666">📋 ' + scs.length + ' phiếu sửa chữa</span>' +
      '<button class="btn sm ghost" onclick="this.closest(\'.ovl\').remove()" style="font-size:18px;padding:4px 8px">✕</button>' +
    '</div>';
  scs.forEach(function (sc, idx) {
    var stColor = TT_COLOR[sc.trang_thai] || '#999';
    var stLabel = TT_LABEL[sc.trang_thai] || sc.trang_thai;
    var ngayLap = sc.ngay ? new Date(sc.ngay).toLocaleDateString('vi-VN') : '—';
    var ngayBD = sc.ngay_bat_dau ? new Date(sc.ngay_bat_dau).toLocaleDateString('vi-VN') : '—';
    var ngayHen = sc.ngay_du_kien ? new Date(sc.ngay_du_kien).toLocaleDateString('vi-VN') : '—';
    var ngayNT = sc.ngay_nghiem ? new Date(sc.ngay_nghiem).toLocaleDateString('vi-VN') : '—';
    var loai = sc.la_sua_ngoai ? '<span class="badge sm" style="background:#FFF3E0;color:#E65100">NC ngoài</span>'
                                : '<span class="badge sm" style="background:#E8F5E9;color:#2E7D32">Xưởng</span>';
    var steps = [
      { label:'Lập', date:ngayLap, done:!!sc.ngay },
      { label:'Duyệt', date:sc.nguoi_duyet ? 'bởi '+sc.nguoi_duyet : '—', done:!!sc.nguoi_duyet },
      { label:'Bắt đầu', date:ngayBD, done:!!sc.ngay_bat_dau },
      { label:'Hẹn trả', date:ngayHen, done:false, special:true },
      { label:'Nghiệm thu', date:ngayNT, done:!!sc.ngay_nghiem }
    ];
    var timeline = '<div class="vhd-timeline"><div class="vhd-tl-track"></div>' +
      steps.map(function (s) {
        var cls = s.done ? 'done' : (s.special ? 'eta' : '');
        return '<div class="vhd-tl-step ' + cls + '"><div class="vhd-tl-dot"></div>' +
               '<div class="vhd-tl-label">' + s.label + '</div><div class="vhd-tl-date">' + s.date + '</div></div>';
      }).join('') + '</div>';
    html += '<div style="border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;' + (idx>0?'margin-top:12px':'') + '">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="font-weight:600;font-size:14px">' + esc(sc.id) + '</span>' +
        '<span class="badge sm" style="background:' + stColor + '20;color:' + stColor + '">' + stLabel + '</span>' +
        loai + '<span class="muted" style="font-size:12px;margin-left:auto">' + esc(sc.nguoi_lap || '—') + '</span>' +
      '</div>' +
      '<div style="font-size:13px;color:#555;margin-bottom:8px">' + esc(sc.mo_ta || 'Không có mô tả') + '</div>' +
      timeline +
      '<div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:#666">' +
        '<span>💰 ' + esc(sc.tong_vnd) + '</span>' +
        '<span>🔧 ' + sc.so_cv_hoan + '/' + sc.so_cv + ' việc' + (sc.tho ? ' · ' + esc(sc.tho) : '') + '</span>' +
        (sc.ngay_bat_dau ? '<span>▶ ' + esc(sc.ngay_bat_dau) + '</span>' : '') +
      '</div></div>';
  });
  html += '</div></div>';
  var old = document.getElementById('vhdModal'); if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}
```

## 6.5 TIMELINE CSS (verbatim `theme-dash.css` 184–250)
```css
#vhdModal { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
.vhd-timeline { display: flex; gap: 0; position: relative; padding: 16px 0 4px; }
.vhd-tl-track { position: absolute; top: 26px; left: 16px; right: 16px; height: 3px; background: #E5E7EB; border-radius: 9999px; z-index: 0; }
.vhd-tl-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 1; }
.vhd-tl-dot { width: 12px; height: 12px; border-radius: 9999px; background: #D1D5DB; border: 2px solid #fff; box-shadow: 0 0 0 2px #D1D5DB; margin-bottom: 6px; }
.vhd-tl-step.done .vhd-tl-dot { background: #10B981; box-shadow: 0 0 0 2px #10B981; }
.vhd-tl-step.eta .vhd-tl-dot { background: #F59E0B; box-shadow: 0 0 0 2px #F59E0B; }
.vhd-tl-label { font-size: 10px; font-weight: 600; color: #6B7280; text-align: center; }
.vhd-tl-step.done .vhd-tl-label { color: #059669; }
.vhd-tl-step.eta .vhd-tl-label { color: #D97706; }
.vhd-tl-date { font-size: 9px; color: #9CA3AF; text-align: center; margin-top: 2px; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

## 6.6 CÔNG VIỆC THEO THỢ + BÁO CÁO (verbatim `theme-dash.css` 64–154)
- `.kb-tho .tho`: flex, avatar 36px gradient (primary / alt accent), name, progress ring (`.tho-progress i` gradient primary→accent), số `tho-n` accent.
- `.bc-row`: label 220px + track gradient (primary trong / accent ngoài) + value right.

## 6.7 PORT (v4)
- `DashboardPage` gọi `dashboardAll()` → render 5 cột từ `cols`, mỗi card `VehicleCard` (onClick mở `<VehicleDetailModal>`).
- `VehicleDetailModal` nhận `vehicle` (tìm từ data theo `bks`) → render timeline 5 bước (Lập→Duyệt→Bắt đầu→Hẹn trả→Nghiệm thu).
- Modal này là **tầng trung** (z 1000) — ESC đóng trước modal form (xem §07).
- `useRealtime('sc')` + `useRealtime('de_xuat_sua_chua')` để KPI/Kanban tự cập nhật.

## 6.8 LƯU Ý
- **1 xe = 1 ô** (group SC cùng BKS) — giữ nguyên logic `dashboardAll`.
- ETA badge: `ok`(xanh) / `today`(vàng) / `late`(đỏ).
- Modal timeline: dot xanh = done, vàng = ETA (hẹn trả), xám = chưa.
- Đối chiếu `UI_DOI_CHIEU_TU_V3.md` mục 2.3 (Kanban) — copy 100%.
