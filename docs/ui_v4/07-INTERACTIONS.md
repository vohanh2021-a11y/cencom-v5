# 07 — INTERACTIONS (phím tắt · palette · ESC · hover)

> Verbatim từ `index.html` 1711–1739 (global keydown) + `gd3.js` 3470–3560 (palette/help/isTyping).

## 7.1 GLOBAL KEYDOWN (verbatim `index.html`)
```js
/* B1+B5: phím tắt toàn cục (Ctrl+K palette · ? help · N tạo SC · R làm mới · Esc đóng) */
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); if (window.cmdPalette) window.cmdPalette(); return;
  }
  var palOpen = !!document.getElementById('palette');
  if (palOpen) {
    if (e.key === 'Escape') { e.preventDefault(); if (window.clPalette) window.clPalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (window.palNav) window.palNav(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (window.palNav) window.palNav(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (window.palGo) window.palGo(); return; }
  }
  if (window.isTyping && window.isTyping()) return;
  if (e.key === 'Escape') {
    /* Thứ tự đóng: toast (nhỏ nhất) → modal hồ sơ xe Kanban → modal form chung */
    var _tt = document.getElementById('toast');
    if (_tt && _tt.classList.contains('show')) { toastHide(); return; }
    var _vhd = document.getElementById('vhdModal');
    if (_vhd) { _vhd.remove(); return; }
    if (window.clModal) window.clModal(); return;
  }
  if (e.key === '?') { if (window.showHelpSheet) { e.preventDefault(); window.showHelpSheet(); } return; }
  if (e.key.toLowerCase() === 'n' && CUR === 'sc') { go('scnew'); return; }
  if (e.key.toLowerCase() === 'r' && window.CUR_ME) {
    var curV = CUR || '';
    if (window.View2 && View2[curV]) View2[curV]();
  }
});
```

## 7.2 isTyping (verbatim `gd3.js` 3470)
```js
window.isTyping = function () {
  var el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};
```

## 7.3 SHORTCUT TABLE (copy 100%)
| Phím | Hành vi | Điều kiện |
|---|---|---|
| **Ctrl/Cmd+K** | Mở Command Palette (tìm SC/vật tư/ĐN/thăm khám) | preventDefault |
| **Esc** (palette mở) | Đóng palette | `palOpen` |
| **↑/↓** (palette) | Di chuyển chọn | `palOpen` |
| **Enter** (palette) | Chọn → `go(v)` + mở detail | `palOpen` |
| **Esc** (không palette) | Đóng thứ tự: toast → `vhdModal` → `clModal` | — |
| **?** | Sheet trợ giúp phím tắt | — |
| **N** | Tạo SC mới | chỉ khi `CUR==='sc'` |
| **R** | Làm mới màn hiện tại | `CUR_ME` tồn tại |

- **Guard `isTyping()`**: chặn N/R/?/Esc khi đang focus INPUT/TEXTAREA/SELECT (không bắt Ctrl+K).
- **Thứ tự z-index**: Toast(9999) < vhdModal(1000) < Modal form(9998) < Palette(300) < Preview(1000) < Auth. ESC ưu tiên toast → vhd → form.

## 7.4 COMMAND PALETTE (verbatim `gd3.js` 3483–3560)
```js
window.clPalette = function () { var d = document.getElementById('palette'); if (d) d.remove(); PAL_.idx=-1; PAL_.items=[]; };
window.cmdPalette = function () {
  if (document.getElementById('palette')) { window.clPalette(); return; }
  PAL_.idx=-1; PAL_.items=[];
  var d = document.createElement('div');
  d.id = 'palette';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(6,45,30,.4);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh';
  d.innerHTML =
    '<div style="background:var(--surface);border-radius:16px;width:min(620px,92vw);box-shadow:0 24px 70px rgba(0,0,0,.4);overflow:hidden">' +
      '<input id="palIn" placeholder="🔍 Tìm phiếu / vật tư / đề nghị / thăm khám…   (Esc đóng)" style="width:100%;border:none;outline:none;padding:18px 20px;font-size:15px;background:transparent">' +
      '<div id="palOut" style="max-height:52vh;overflow:auto;border-top:1px solid var(--line);padding:8px"></div>' +
    '</div>';
  document.body.appendChild(d);
  d.addEventListener('mousedown', function (e) { if (e.target === d) window.clPalette(); });
  var inp = document.getElementById('palIn'); inp.focus();
  var timer = null; inp.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runPal, 180); });
  resetPal();
  // resetPal: nhóm "Hành động nhanh": scnew, nhapkho, xuatkho, dm, tk, dash
  // runPal: gọi scList/vatTuList/dmList/tkList (debounce 180ms), filter theo q, slice 6/nhóm
  // palGo: chạy item được chọn (PAL_.idx), sau đó go(v) + openDetailById/openDM
};
window.palGo = function () { var f = (PAL_.idx >= 0 && PAL_.items[PAL_.idx]) ? PAL_.items[PAL_.idx] : PAL_.items[0]; if (!f) return; window.clPalette(); f(); };
window.palNav = function (dir) { /* di chuyển PAL_.idx trong #palOut .pal-item */ };
```
- Palette overlay `z-index:300`, glass `rgba(6,45,30,.4)`, panel `min(620px,92vw)`.
- Debounce 180ms khi gõ; groups: Hành động nhanh + kết quả (Phiếu sửa chữa / Vật tư / Đề nghị mua / Yêu cầu thăm khám).
- Click ngoài overlay (`e.target===d`) → đóng.

## 7.5 HOVER / MICRO-INTERACTIONS
- `.btn:hover` → `translateY(-1px)` + `shadow-md` (02).
- `.theme-home .kpi:hover` → `scale(1.05)` (03.1).
- `.theme-dash .kpi:hover` → `translateY(-4px) scale(1.02)` + `shadow-xl` + `::after` radial (03.2).
- `.theme-dash .kb-card:hover` → `translateY(-4px) rotate(-.5deg)` + `shadow-lg` (03.2).
- `.theme-dash .kb-tho .tho:hover` → `translateY(-2px)` + `shadow-md`.
- `.rate button:hover` → `scale(1.06)` (từ UI_DOI_CHIEU/rating).
- Toast: `toastIn .28s` slide-x (03.3). Modal: `fadeIn .2s` + `slideUp .3s` (02.5).

## 7.6 PORT (v4)
- `useGlobalKeys()` hook (Client): lắng nghe `keydown`, replicate §7.1–7.3 (dùng React state thay `CUR`, `CUR_ME`).
- `isTyping()`: `document.activeElement` tagName ∈ {INPUT,TEXTAREA,SELECT}.
- `<CommandPalette/>`: state `open`, input debounce 180ms gọi `useRpc` (scList/vatTuList/dmList/tkList), arrow nav + Enter.
- ESC order: Toast context → VehicleDetailModal → Modal → Palette (dùng stacking context/refs).
- `showHelpSheet()`: `<Modal>` nội dung bảng phím tắt §7.3.

## 7.7 ĐỐI CHIẾU UI_DOI_CHIEU
- **2.1 Toast**: tự ẩn 1.5s, click/✕/ESC đóng ✅ (port ToastProvider).
- **2.2 ESC**: đóng đúng thứ tự toast→vhd→form ✅ (§7.1).
- **2.4 Role Preview** ✅ (GĐ-B: route `/preview`, RBAC admin). **2.5 Laixe**: ❌ ĐÃ BỎ (quyết định GĐ-B: bỏ Tablet thợ + Cổng lái xe).
