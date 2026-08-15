# 05 — HOME (Trang chủ · Glass theme)

> Theme: `theme-home` (xem 03). Port: `apps/web/app/(app)/home/page.tsx` (Client, gọi `welcomeData()` RPC).
> Mục đích: tổng quan nhanh + truy cập nhanh + thông báo.

## 5.1 BỐ CỤC (từ `drawNotif` + `gd3.js`)
1. **Banner chào mừng** (glass): "Xin chào {tên}" + ngày + role.
2. **KPI glass cards** (`.kpis` grid auto-fit minmax(160–180px,1fr)): 5 chỉ số (SC chờ duyệt, đang sửa, chờ nghiệm, ĐN mua chờ, vật tư sắp hết) — mỗi card `.kpi` glass, hover `scale(1.05)`.
3. **Quick shortcuts** (`.quick` glass pills): Tạo SC, Nhập kho, Xuất kho, Đề nghị mua, Thăm khám, Bảng điều khiển → `go(v)`.
4. **"Việc cần xử lý"** (`.due` glass, border-left cam): list từ `welcomeData().jobs` + `approve_sc` → link `openDetailById(id)`.
5. **"Vật tư sắp hết"** (table glass): `lowTon` (ton ≤ ton_min) → link `go('vattu')`.
6. **NotificationCenter** (xem 04.3): click 🔔 mở `notifPanel`.

## 5.2 RENDER THAM CHIẾU (trích `gd3.js` `drawNotif`)
```js
// d = welcomeData(): { jobs:[{type,sc_id,bks,ten,tong}], approve_sc:[...], lowTon:[...], chatUnread, ... }
// .due item:
'<div class="due"><div><b>'+bks+'</b><span class="chip" style="margin-left:8px">'+vnd(tong)+'</span></div>'+
'<div><a href="javascript:openDetailById(\''+sc_id+'\')">Xem phiếu →</a></div></div>'
```
- `.chip` (trong glass): `background: rgba(255,255,255,.16); color:#fff`.
- `.due` (trong glass): `background: rgba(255,255,255,.08); border-left:3px solid var(--c-accent-light)`.

## 5.3 PORT (v4)
```tsx
'use client';
export default function HomePage() {
  const { data } = useRpc('welcomeData'); // POST /api/rpc {fn:'welcomeData'}
  return (
    <div className="theme-home min-h-screen bg-gradient-to-br from-primary via-primary-lighter to-accent-light">
      <Banner/> <KpiGrid items={data?.kpis}/>
      <QuickLinks/> <DueList items={data?.jobs}/> <LowTonTable items={data?.lowTon}/>
    </div>
  );
}
```
- Mọi text trên nền glass → `text-white`; link → `text-[#FFE1B3]` hover underline (theo 03.1).
- Fallback `@supports not backdrop-filter` → `bg-[rgba(11,61,41,.72)]`.

## 5.4 LƯU Ý
- Home là **landing sau login** (đổi `login.tsx` redirect từ `/dashboard` → `/home`).
- KPI dùng số fluid (`var(--text-3xl)` ở Dash; ở Home giữ `.kpi` glass nhỏ gọn).
- Giữ nguyên thứ tự section + icon.
