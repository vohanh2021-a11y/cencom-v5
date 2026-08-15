# 01 — DESIGN TOKENS (verbatim từ `tokens.css`)

> File gốc: `CencomOS-Garage-v3.6/client/src/tokens.css` (89 dòng). Copy nguyên vẹn.

## 1. CSS VERBATIM
```css
/* ============================================
   DESIGN TOKENS — CencomOS v3.8
   ============================================ */
@layer base {
  :root {
    /* ---- Color Palette (Cencom Brand) ---- */
    --c-primary: #0E5A37;
    --c-primary-light: #12794A;
    --c-primary-lighter: #14A05F;
    --c-primary-subtle: #E8F5EE;
    --c-accent: #F28C1D;
    --c-accent-light: #FFB703;
    --c-accent-subtle: #FFF8E6;

    /* ---- Neutrals ---- */
    --c-bg: #FBF6EE;
    --c-surface: #FFFFFF;
    --c-elevated: #FFFFFF;
    --c-line: #E7E2D9;
    --c-line-light: #F0EDE6;
    --c-ink: #26372C;
    --c-ink-secondary: #6C7666;
    --c-ink-muted: #9CA3AF;

    /* ---- Status ---- */
    --c-ok: #2E9E5B;
    --c-ok-bg: #E8F5EE;
    --c-warn: #E8A33D;
    --c-warn-bg: #FFF8E6;
    --c-danger: #D64545;
    --c-danger-bg: #FDEDEC;
    --c-info: #5BA8D4;
    --c-info-bg: #EAF4FF;

    /* ---- Spacing (4px base) ---- */
    --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
    --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px;

    /* ---- Typography (fluid clamp) ---- */
    --font-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
    --text-xs:  clamp(11px, 0.9vw + 6px, 12px);
    --text-sm:  clamp(12px, 0.9vw + 7px, 13px);
    --text-base:clamp(13px, 0.9vw + 8px, 15px);
    --text-lg:  clamp(15px, 1vw + 9px, 17px);
    --text-xl:  clamp(18px, 1.2vw + 10px, 20px);
    --text-2xl: clamp(22px, 1.5vw + 10px, 28px);
    --text-3xl: clamp(28px, 2vw + 10px, 36px);
    --text-hero:clamp(32px, 3vw + 10px, 48px);

    /* ---- Font Weight ---- */
    --fw-normal: 400; --fw-medium: 500; --fw-semibold: 600;
    --fw-bold: 700; --fw-extrabold: 800;

    /* ---- Border Radius ---- */
    --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px; --r-full: 9999px;

    /* ---- Shadows ---- */
    --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04);
    --shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);

    /* ---- Glass Effect ---- */
    --glass-bg: rgba(255,255,255,0.12);
    --glass-border: rgba(255,255,255,0.2);
    --glass-blur: blur(20px);

    /* ---- Transitions ---- */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

## 2. CÁCH ĐẶT TRONG v4
- **Tailwind v4**: khai báo trong `@theme` (file `app/globals.css`):
  ```css
  @import "tailwindcss";
  @theme {
    --color-primary: #0E5A37;
    --color-primary-light: #12794A;
    --color-primary-lighter: #14A05F;
    --color-accent: #F28C1D;
    --color-bg: #FBF6EE;
    --color-surface: #FFFFFF;
    /* ...giữ nguyên toàn bộ giá trị trên... */
    --radius-lg: 14px; --radius-xl: 20px;
    --shadow-md: 0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
  }
  ```
- **Giữ `:root` raw tokens** (để component CSS cũ tái dùng): thêm block `@layer base { :root { ... } }` y hệt verbatim.
- **Fluid type**: map `--text-*` vào utility hoặc dùng trực tiếp `text-[length:var(--text-xl)]`.
- **Glass**: `--glass-blur: blur(20px)` → Tailwind `backdrop-blur-[20px]` hoặc class `.glass`.

## 3. LƯU Ý
- Màu brand CENCOM (xanh `#0E5A37` / cam `#F28C1D`) — **thay thế** navy Hyundai `#002C5F` từ GĐ3.
- Không đổi giá trị clamp/shadow — giữ nguyên để đồng bộ với v3.8.
