# 02 — COMPONENTS (verbatim từ `client/src/components/*.css`)

> 8 components: button, card, badge, skeleton, modal, toast, empty, table. Copy nguyên vẹn.
> Port: mỗi file → 1 React component trong `apps/web/components/ui/`.

## 2.1 BUTTON (`button.css`)
```css
@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-2 font-medium rounded-lg
           transition-all duration-200 cursor-pointer select-none
           focus:outline-none focus:ring-2 focus:ring-offset-2;
    padding: var(--sp-2) var(--sp-4);
    font-size: var(--text-sm);
    min-height: 36px;
  }
  .btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .btn:active { transform: translateY(0); }
  .btn-primary { @apply text-white; background: linear-gradient(135deg, var(--c-primary), var(--c-primary-light)); }
  .btn-primary:hover { background: linear-gradient(135deg, var(--c-primary-light), var(--c-primary-lighter)); }
  .btn-accent { @apply text-white; background: linear-gradient(135deg, var(--c-accent), #E88A10); }
  .btn-ghost { @apply bg-transparent border text-[var(--c-ink)]; border-color: var(--c-line); }
  .btn-ghost:hover { background: var(--c-line-light); }
  .btn-danger { @apply text-white; background: var(--c-danger); }
  .btn-sm { @apply text-xs; padding: var(--sp-1) var(--sp-3); min-height: 28px; }
  .btn-lg { @apply text-base; padding: var(--sp-3) var(--sp-6); min-height: 44px; }
}
```
**Port**: `<Button variant="primary|accent|ghost|danger" size="sm|md|lg">`. Hover `translateY(-1px)` + shadow-md.

## 2.2 CARD (`card.css`)
```css
@layer components {
  .card { @apply rounded-xl border; background: var(--c-surface); border-color: var(--c-line); box-shadow: var(--shadow-sm); }
  .card-hd { @apply px-5 py-4 border-b; border-color: var(--c-line-light); }
  .card-bd { @apply p-5; }
  .card-glass { background: var(--glass-bg); backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
  .card-bold { @apply rounded-xl; box-shadow: var(--shadow-lg); transition: transform var(--transition-base), box-shadow var(--transition-base); }
  .card-bold:hover { transform: translateY(-4px); box-shadow: var(--shadow-xl); }
}
```
**Port**: `<Card variant="default|glass|bold">`. `card-glass` dùng Home, `card-bold` dùng Dashboard.

## 2.3 BADGE (`badge.css`)
```css
@layer components {
  .badge { @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold; }
  .badge-ok { background: var(--c-ok-bg); color: var(--c-ok); }
  .badge-warn { background: var(--c-warn-bg); color: var(--c-warn); }
  .badge-danger { background: var(--c-danger-bg); color: var(--c-danger); }
  .badge-info { background: var(--c-info-bg); color: var(--c-info); }
  .badge-neutral { @apply bg-gray-100 text-gray-600; }
}
```
**Thêm (từ theme-dash)**: ETA `.eta-ok/.eta-today/.eta-late` (xanh/vàng/đỏ) + KB badges `.badge.sm.blue/purple/orange`.

## 2.4 SKELETON (`skeleton.css`)
```css
@layer components {
  .sk { @apply animate-pulse rounded; background: linear-gradient(90deg, var(--c-line-light) 25%, var(--c-line) 50%, var(--c-line-light) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
  .sk-text { @apply h-4 w-full; } .sk-text-sm { @apply h-3 w-2/3; }
  .sk-card { @apply h-32 w-full rounded-xl; } .sk-table { @apply h-10 w-full mb-2; } .sk-circle { @apply rounded-full; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
}
```
**Port**: `<Skeleton variant="text|card|table|circle">`. Shimmer 1.5s.

## 2.5 MODAL (`modal.css`)
```css
@layer components {
  .modal-overlay { @apply fixed inset-0 z-[9998] flex items-center justify-center; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); animation: fadeIn 200ms ease; }
  .modal-panel { @apply bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto; animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1); }
  .modal-header { @apply px-6 py-4 border-b flex items-center justify-between; border-color: var(--c-line-light); }
  .modal-body { @apply px-6 py-4; }
  .modal-footer { @apply px-6 py-4 border-t flex items-center justify-end gap-3; border-color: var(--c-line-light); }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
}
```
**Port**: `<Modal open onClose>` (portal). `Escape` → `onClose` (xem §07 thứ tự ESC).

## 2.6 TOAST (`toast.css`)
```css
@layer components {
  .toast { @apply fixed z-[9999] px-4 py-3 rounded-xl text-sm font-medium shadow-xl; top: 20px; right: 20px; transform: translateX(calc(100% + 20px)); transition: transform var(--transition-slow); max-width: 360px; }
  .toast.show { transform: translateX(0); }
  .toast-ok { @apply text-white; background: var(--c-ok); }
  .toast-err { @apply text-white; background: var(--c-danger); }
  .toast-info { @apply text-white; background: var(--c-info); }
}
```
**Port**: `<ToastProvider>` + `useToast()`. Tự ẩn **1.5s**, click/✕/ESC đóng (chuẩn `UI_DOI_CHIEU 2.1`). `max-width:360px`.

## 2.7 EMPTY / TABLE (tóm tắt)
- `empty.css`: `.empty-state { @apply py-12 text-center; } .empty-state .ic { opacity:.4; }`
- `table.css`: `.tbl { @apply w-full border-separate border-spacing-0; } thead th { @apply text-left uppercase tracking-wider text-[var(--c-ink-muted)] text-xs font-semibold border-b-2 border-[var(--c-line)]; } tbody td { @apply px-4 py-3 border-b border-[var(--c-line-light)]; } tbody tr:hover { background: var(--c-primary-subtle); }`

## 2.8 LƯU Ý PORT
- Giữ `@apply` (Tailwind) nguyên; chỉ chuyển `@layer components` thành class component hoặc utility trực tiếp.
- Mọi `var(--c-*)` phải có trong `@theme` (§01).
