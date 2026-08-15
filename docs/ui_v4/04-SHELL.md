# 04 — SHELL (verbatim từ `index.html` dòng 408–477)

> Sidebar (nav RBAC) + Topbar + NotificationCenter. Port: `apps/web/app/(app)/layout.tsx`
> + components `Sidebar`/`Topbar`/`NotificationCenter` (Client Components).

## 4.1 CẤU TRÚC HTML GỐC
```html
<div class="shell">
  <aside class="side" id="side">
    <div class="logo">
      <div class="brand"><div class="mark">C</div>
        <div class="name">CencomOS-Garage<span>GĐ3 · Gara &amp; Tài sản</span></div></div>
    </div>
    <nav id="gNav">
      <div class="lbl">Tổng quan</div>
      <a data-v="home" onclick="go('home')"><span class="ic">🏠</span> Trang chủ</a>
      <a data-v="dash" class="active" onclick="go('dash')"><span class="ic">▦</span> Bảng điều khiển</a>
      <div class="lbl">Gara — Quy trình 8 bước</div>
      <a data-v="sc"><span class="ic">🔧</span> Phiếu sửa chữa</a>
      <a data-v="tk"><span class="ic">🩺</span> Yêu cầu thăm khám</a>
      <a data-v="hoso"><span class="ic">📋</span> Bộ hồ sơ 8 bước</a>
      <div class="lbl">Xưởng &amp; Kho</div>
      <a data-v="xuong"><span class="ic">🏭</span> Bảng điều hành xưởng</a>
      <a data-v="baogia"><span class="ic">📋</span> Báo giá NCC</a>
      <a data-v="dm"><span class="ic">🛒</span> Đề nghị mua</a>
      <a data-v="nhapkho"><span class="ic">⤵</span> Nhập kho</a>
      <a data-v="xuatkho"><span class="ic">⤴</span> Xuất kho</a>
      <a data-v="thanhly"><span class="ic">♻</span> VT thanh lý</a>
      <a data-v="vattu"><span class="ic">▤</span> Danh mục vật tư</a>
      <div class="lbl">Tài chính</div>
      <a data-v="asset"><span class="ic">💰</span> Quýết toán</a>
      <div class="lbl">Nhắn tin</div>
      <a data-v="chat"><span class="ic">💬</span> Nhắn tin &amp; Giao việc<span class="ic-r" id="chatBadge"></span></a>
      <div class="lbl">Kiểm tra</div>
      <a data-v="insp"><span class="ic">✓</span> Phiếu kiểm tra</a>
      <a data-v="imp"><span class="ic">⤓</span> Nhập xe</a>
      <div class="lbl">Phân tích</div>
      <a data-v="health"><span class="ic">❤</span> Nhật ký sức khỏe</a>
      <a data-v="report"><span class="ic">▤</span> Báo cáo quản lý</a>
      <div class="lbl">Danh mục · Hệ thống</div>
      <a data-v="boards"><span class="ic">▧</span> Phòng ban</a>
      <a data-v="admin" style="display:none"><span class="ic">◈</span> Quản trị nhân sự</a>
      <a data-v="perm" style="display:none"><span class="ic">⚙</span> Phân quyền &amp; ngưỡng</a>
      <a data-v="preview" style="display:none"><span class="ic">🔎</span> Xem thử vai trò</a>
      <!-- Tablet thợ & Cổng lái xe: ĐÃ BỎ (quyết định GĐ-B) -->
    </nav>
    <div class="foot"><b>CencomOS-Garage</b><br>CÔNG TY CP VLXD MIỀN TRUNG<br>GĐ3.6 · SQLite · Tự hosting</div>
  </aside>

  <div class="main">
    <div class="topbar">
      <button class="menu-btn" id="menuBtn" onclick="menuToggle()">☰</button>
      <h1 id="pageTitle">Bảng điều khiển</h1>
      <span class="crumb" id="pageCrumb">Tổng quan đội xe</span>
      <div class="grow"></div>
      <button class="btn ghost sm" id="qrBtn" style="display:none" onclick="showQrModal()">📱 QR truy cập</button>
      <button class="btn ghost sm" id="chPwBtn" style="display:none" onclick="openChPw()">Đổi mật khẩu</button>
      <span class="who-chip" id="whoChip">…</span>
      <button class="btn ghost sm" id="notifBtn" onclick="notifToggle()" style="position:relative">🔔<span id="notifBadge" style="display:none;position:absolute;top:-4px;right:-4px;background:#E0332E;color:#fff;font-size:10px;border-radius:999px;padding:1px 6px">0</span></button>
      <button class="btn ghost sm" id="logoutBtn" style="display:none" onclick="cenAuth.logout().then(()=>location.reload())">Thoát</button>
    </div>
    <div id="notifPanel" style="display:none;position:fixed;right:92px;top:56px;width:340px;max-height:70vh;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);z-index:120;padding:10px"></div>
    <div class="content" id="view"></div>
  </div>
</div>
<div class="scrim" id="scrim" onclick="menuClose()"></div>
<div class="toast" id="toast"></div>
```

## 4.2 GATING THEO VAI (từ v3.6)
- `admin` / `perm` / `preview` ẩn (`display:none`) với non-admin → port: đọc `permissions` từ session → `{show}` theo RBAC.
- `qrBtn` / `chPwBtn` / `logoutBtn` ẩn cho đến khi auth xong (`initAuth` callback).
- `whoChip` = tên + role người dùng hiện tại.

## 4.3 NOTIFICATIONCENTER
- `notifPanel` fixed `right:92px top:56px width:340px max-h:70vh z:120`.
- Badge `notifBadge` tổng hợp: chatUnread + lowTon + việc dở + tk chờ duyệt/xưởng (từ `setBadge(d)`).
- Port: component `<NotificationCenter/>` gọi `welcomeData()` (RPC) + `useRealtime` để cập nhật badge.

## 4.4 PORT (v4)
- `layout.tsx` (Server Component): chỉ render `<Shell>` wrapper, KHÔNG đặt `onClick` trực tiếp (đã gây 500 ở GĐ9).
- `Sidebar`, `Topbar`, `NotificationCenter`, `LogoutButton` = Client Components (`'use client'`).
- Nav dùng `next/navigation` `useRouter().push('/sc')` thay `go('sc')`.
- `whoChip` lấy từ `useAuth()` context.

## 4.5 LƯU Ý
- Giữ icon + label nguyên văn (🏠 Trang chủ, ▦ Bảng điều khiển, 🔧 Phiếu sửa chữa…).
- Active state: `inset 3px 0 0 var(--cyan)` (xem `sidebar.css` gốc) → port `border-l-[3px] border-cyan-400 bg-white/10`.
- Logo "C" mark xanh CENCOM.
