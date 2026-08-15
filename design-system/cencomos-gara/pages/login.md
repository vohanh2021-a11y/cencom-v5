# Login Page Design Override

**Page:** `/login`
**Theme:** Calm
**Priority:** High (authentication gateway)

## Layout

- Centered card on gradient background (CENCOM green→amber)
- Logo: CENCOM mark + "CENCOMOS" brand text
- Form: minimal (username + password + submit)
- Error message: below form (near-field)
- "Quên mật khẩu" link + "Đăng nhập bằng Mật khẩu cũ" toggle

## Typography

- Logo text: `var(--text-xl)` extrabold white
- Brand subtitle: `var(--text-xs)` uppercase, 60% opacity
- Form labels: `var(--text-sm)` semibold, `--c-ink`
- Input placeholder: `--c-ink-muted` (40% opacity)
- Error: `var(--text-xs)` `--c-danger`, near-field (under form)

## Color Overrides

- Page background: `linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-lighter) 50%, var(--c-accent-light) 100%)`
- Card: white surface, shadow-xl, border-radius 20px
- Input focus: `box-shadow: 0 0 0 2px var(--c-accent-subtle)`
- Submit button: full width, gradient green, white text, hover scale(1.02)

## Pre-Existing Notes

- `loading` state: button disabled + "Đang xử lý..." text
- Password visibility toggle
- Change password page follows same theme
