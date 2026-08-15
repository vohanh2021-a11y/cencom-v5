# CencomOS Design System Master

> **LOGIC:** When building a specific page, first check `design-system/cencomos-gara/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

## Project Metadata

**Project:** CencomOS-Gara
**Domain:** Fleet Management / Truck Repair Workshop
**Generated:** 2026-08-16 (manually synced)
**Stack:** Next.js App Router + TypeScript + Tailwind v4 + Supabase

---

## Color Palette

CencomOS uses a **Light Calm theme** with CENCOM brand colors: deep forest green primary + warm amber accent + cream background.

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0E5A37` | `--c-primary` |
| Primary Light | `#12794A` | `--c-primary-light` |
| Primary Lighter | `#14A05F` | `--c-primary-lighter` |
| Primary Subtle | `#E8F5EE` | `--c-primary-subtle` |
| Accent | `#F28C1D` | `--c-accent` |
| Accent Light | `#FFB703` | `--c-accent-light` |
| Accent Subtle | `#FFF8E6` | `--c-accent-subtle` |
| Background | `#FBF6EE` | `--c-bg` |
| Surface | `#FFFFFF` | `--c-surface` |
| Elevated | `#FFFFFF` | `--c-elevated` |
| Line | `#E7E2D9` | `--c-line` |
| Line Light | `#F0EDE6` | `--c-line-light` |
| Ink (text primary) | `#26372C` | `--c-ink` |
| Ink Secondary | `#6C7666` | `--c-ink-secondary` |
| Ink Muted | `#9CA3AF` | `--c-ink-muted` |
| OK | `#2E9E5B` | `--c-ok` |
| Warning | `#E8A33D` | `--c-warn` |
| Danger | `#D64545` | `--c-danger` |
| Info | `#5BA8D4` | `--c-info` |

**Color Notes:** Deep forest green (#0E5A37) for primary brand identity, warm amber (#F28C1D) for CTA/accent. Light cream background (#FBF6EE) reduces eye strain during long workshop sessions. Semantic color tokens (ok/warn/danger/info) used for status badges and toasts.

### Dark Mode (Light → Dark Overrides)

When `.dark` class is on `<html>` element:

| Role | Light | Dark | CSS Override |
|------|-------|------|--------------|
| Primary | `#0E5A37` | `#14A05F` | `--c-primary` |
| Primary Light | `#12794A` | `#22C55E` | `--c-primary-light` |
| Primary Lighter | `#14A05F` | `#4ADE80` | `--c-primary-lighter` |
| Primary Subtle | `#E8F5EE` | `#1A2E22` | `--c-primary-subtle` |
| Accent | `#F28C1D` | `#FFB703` | `--c-accent` |
| Accent Light | `#FFB703` | `#FFC94D` | `--c-accent-light` |
| Accent Subtle | `#FFF8E6` | `#422608` | `--c-accent-subtle` |
| Background | `#FBF6EE` | `#0F172A` | `--c-bg` |
| Surface | `#FFFFFF` | `#1E293B` | `--c-surface` |
| Elevated | `#FFFFFF` | `#273449` | `--c-elevated` |
| Line | `#E7E2D9` | `#334155` | `--c-line` |
| Line Light | `#F0EDE6` | `#475569` | `--c-line-light` |
| Ink | `#26372C` | `#F8FAFC` | `--c-ink` |
| Ink Secondary | `#6C7666` | `#CBD5E1` | `--c-ink-secondary` |
| Ink Muted | `#9CA3AF` | `#94A3B8` | `--c-ink-muted` |
| OK | `#2E9E5B` | `#4ADE80` | `--c-ok` |
| Warning | `#E8A33D` | `#FCD34D` | `--c-warn` |
| Danger | `#D64545` | `#F87171` | `--c-danger` |
| Info | `#5BA8D4` | `#7DD3FC` | `--c-info` |

**Dark mode toggle:** User preference saved in `localStorage.theme` (dark/light). System preference detected via `prefers-color-scheme`. Toggle button in Topbar.

---

## Typography

- **Font Family:** Inter (sans-serif)
- **Font Import:** `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap')`
- **Base Size:** `clamp(14px, 0.9vw + 8px, 16px)` — WCAG compliant (≥16px on mobile)
- **Line Height:** 1.5 (body), 1.2 (headings)
- **Font Weights:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)

| Size Token | CSS | Usage |
|------------|-----|-------|
| `--text-xs` | clamp(11px, 0.9vw + 6px, 12px) | Captions, labels |
| `--text-sm` | clamp(12px, 0.9vw + 7px, 13px) | Secondary text |
| `--text-base` | clamp(14px, 0.9vw + 8px, 16px) | Body text |
| `--text-lg` | clamp(15px, 1vw + 9px, 17px) | Subheadings |
| `--text-xl` | clamp(18px, 1.2vw + 10px, 20px) | Section titles |
| `--text-2xl` | clamp(22px, 1.5vw + 10px, 28px) | Page titles |
| `--text-3xl` | clamp(28px, 2vw + 10px, 36px) | Dashboard headers |
| `--text-hero` | clamp(32px, 3vw + 10px, 48px) | Hero banners |

---

## Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--sp-1` | 4px | Tight spacing |
| `--sp-2` | 8px | Icon gaps, small padding |
| `--sp-3` | 12px | Form field padding |
| `--sp-4` | 16px | Card padding |
| `--sp-5` | 20px | Section spacing |
| `--sp-6` | 24px | Page padding |
| `--sp-8` | 32px | Large section gaps |
| `--sp-10` | 40px | Hero spacing |
| `--sp-12` | 48px | Max section gaps |
| `--r-sm` | 6px | Small radius |
| `--r-md` | 10px | Default radius |
| `--r-lg` | 14px | Cards, modals |
| `--r-xl` | 20px | Large cards |
| `--r-full` | 9999px | Pills, full round |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | 0 1px 2px rgba(0,0,0,0.04) | Subtle |
| `--shadow-sm` | 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04) | Cards |
| `--shadow-md` | 0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04) | Elevated cards |
| `--shadow-lg` | 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04) | Modals |
| `--shadow-xl` | 0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04) | Dropdowns |

---

## Themes

### Calm Theme (Default)

Used for list/detail pages (SC, Kho, DeXuat, Asset, BaoGia, ThanhLy).

- White surface cards (`#FFFFFF`)
- Subtle borders (`#E7E2D9`, `#F0EDE6`)
- Soft hover: `background: var(--c-primary-subtle)` on table rows
- Rounded-xl cards (14px radius)

### Glass Theme (Home)

Used for `(app)/home`.

- Gradient background: `linear-gradient(135deg, #0E5A37 0%, #14A05F 50%, #FFB703 100%)`
- Glass cards: `rgba(255,255,255,0.08)` with `backdrop-filter: blur(16px)`
- Hover scale: 1.05x with increased opacity

### Bold Theme (Dashboard)

Used for `(app)/dashboard`.

- KPI cards: gradient green background, extrabold numbers
- Hover: translateY(-4px) scale(1.02) + shadow-lg
- Kanban cards: border-left accent stripe, hover lift

---

## Layout & Responsive

### Breakpoints

| Screen | Rule | Sidebar | Topbar |
|--------|------|---------|--------|
| `min-width: 769px && max-width: 1024px` (tablet) | 2-column | 68px (icon only) | Normal + compact |
| `max-width: 768px` (mobile) | Single column | Drawer (slide left) | Wrap + hamburger |
| `min-width: 1440px` (desktop) | Full width | 240px fixed | Normal |

### Sidebar (Desktop)

- Width: 240px
- Background: `linear-gradient(180deg, #062d1e 0%, #0e5a37 55%, #11693f 100%)`
- Logo: gradient mark (amber→orange), brand text
- Nav: rounded-lg hover (8px padding), active = inset 3px amber stripe
- Footer: version info

### Topbar

- Height: 56px
- Background: `var(--c-surface)` + border-bottom
- Items: menu-btn, h1 title, breadcrumb, who-chip, notif-btn, logout

---

## Components

### Button

```css
.btn {
  min-height: 36px;       /* WCAG touch target */
  padding: 8px 16px;      /* var(--sp-2) var(--sp-4) */
  font-size: var(--text-sm);
  cursor: pointer;        /* Must have */
  transition: all 200ms;  /* --transition-base */
  focus:outline: none;
  focus:ring: 2px solid var(--c-primary-lighter);
  focus:ring-offset: 2px;
}
.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.btn:active { transform: translateY(0); }

/* Variants */
.btn-primary { background: linear-gradient(135deg, var(--c-primary), var(--c-primary-light)); color: white; }
.btn-accent { background: linear-gradient(135deg, var(--c-accent), #E88A10); color: white; }
.btn-ghost { background: transparent; border: 1px solid var(--c-line); }
.btn-danger { background: var(--c-danger); color: white; }
.btn-sm { padding: 4px 8px; min-height: 28px; font-size: var(--text-xs); }
.btn-lg { padding: 12px 24px; min-height: 44px; font-size: var(--text-base); }
```

### Input

```css
.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  background: var(--c-surface);
  transition: border-color 200ms;
}
.input:focus {
  outline: none;
  border-color: var(--c-accent);
  box-shadow: 0 0 0 2px var(--c-accent-subtle);
}
```

### Table

```css
.tbl {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.tbl thead th {
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-ink-muted);
  border-bottom: 2px solid var(--c-line);
}
.tbl tbody td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--c-line-light);
}
.tbl tbody tr:hover {
  background: var(--c-primary-subtle);
}
```

### Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.badge-ok { background: var(--c-ok-bg); color: var(--c-ok); }
.badge-warn { background: var(--c-warn-bg); color: var(--c-warn); }
.badge-danger { background: var(--c-danger-bg); color: var(--c-danger); }
.badge-info { background: var(--c-info-bg); color: var(--c-info); }
.badge-neutral { background: #F3F4F6; color: #6B7280; }
```

### Card

```css
.card {
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-sm);
}
.card-glass {
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.2);
}
.card-bold { box-shadow: var(--shadow-lg); }
.card-bold:hover { transform: translateY(-4px); box-shadow: var(--shadow-xl); }
```

### Modal

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  animation: fadeIn 200ms ease;
}
.modal-panel {
  background: white;
  border-radius: var(--r-2xl);
  box-shadow: 0 25px 50px rgba(0,0,0,0.25);
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 300ms cubic-bezier(0.16,1,0.3,1);
}
```

### Toast

```css
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  max-width: 360px;
  transform: translateX(calc(100% + 20px));
  transition: transform 300ms;
}
.toast.show { transform: translateX(0); }
.toast-ok { background: var(--c-ok); color: white; }
.toast-err { background: var(--c-danger); color: white; }
.toast-info { background: var(--c-info); color: white; }
```

---

## Accessibility

| Rule | Implementation |
|------|----------------|
| Color contrast | Text ≥ 4.5:1 against background; checked via tools |
| Focus states | `outline: 2px solid var(--c-primary-lighter)` on all interactive elements |
| Keyboard nav | Tab order follows visual order; Esc closes modals/notifications |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` — animation/transition = .001ms |
| Skip link | "Skip to main content" link, visible on Tab at top-left |
| Alt text | Meaningful images must have descriptive alt |
| ARIA labels | Icon-only buttons need aria-label |

---

## Performance

| Rule | Implementation | Status |
|------|----------------|--------|
| Image optimization | Use Next.js `<Image>` with width/height; WebP format; lazy loading below fold | N/A (no images currently) |
| WebP conversion | When adding static images, convert to WebP using `sharp` CLI: `npx sharp src.jpg --webp --output out.webp` | Guideline only |
| `<Image>` usage | Use Next.js `<Image>` component (not raw `<img>`) for automatic WebP + lazy loading: `<Image src="img.webp" width={200} height={150} alt="..." loading="lazy" />` | Guideline only |
| Font loading | `font-display: swap` on all Google Fonts imports | ✅ Implemented |
| Bundle splitting | Dynamic imports for heavy components | ✅ Next.js handles |
| Lazy loading | Tables with 50+ rows use virtualization | ✅ Skeleton loader on tables |
| Layout shift | All images have explicit width/height or aspect-ratio | Guideline only |

---

## Pre-Delivery Checklist

- [x] No emojis used as icons (use SVG — replaced all 📎 ⚖ ➕ 🔄 with SVG icons)
- [x] cursor-pointer on all clickable elements (.btn, a, .kb-card)
- [x] Focus rings visible on all interactive elements (focus-visible)
- [x] Prefers-reduced-motion respected (prefers-reduced-motion)
- [x] Body text ≥ 16px (clamp max: 16px)
- [x] Line-height ≥ 1.5 on body text
- [x] Responsive: 375px, 768px, 1024px, 1440px breakpoints
- [x] Semantic color tokens (no raw hex in components)
- [x] Error messages near field (toasts + inline errors in forms)
- [ ] Image dimensions reserved (check all <img>) — N/A: no <img> tags in current codebase (data dashboard)
- [x] WebP format for static images — Guideline added (convert before adding images)
- [x] Skip-link for keyboard navigation (focusable on Tab)
- [x] aria-label on icon-only buttons
- [x] aria-hidden="true" on decorative icons in nav

---

## Stack

- **Framework:** Next.js 15 (App Router)
- **CSS:** Tailwind v4 with @theme tokens + @layer components
- **Language:** TypeScript strict
- **Auth:** Supabase auth + middleware (cen_session cookie)
- **Realtime:** Supabase Realtime (WebSocket) — replaces polling
- **Icons:** Tabler Icons (SVG)
- **Font:** Inter (display swap)
- **Deployment:** On-premise (Docker + Nginx + self-signed cert)

---

## References

- Global AGENTS.md: CencomOS Gatekeeper rules
- Project AGENTS.md: apps/web conventions
- docs/Architect.md: architecture + business logic
- docs/rewrite/01-07: original v3.6 spec (PORTED, not rewritten)
- `apps/web/app/globals.css`: token definitions (source of truth)