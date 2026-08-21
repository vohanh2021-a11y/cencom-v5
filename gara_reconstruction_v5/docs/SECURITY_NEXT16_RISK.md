# SECURITY_NEXT16_RISK.md — Rủi ro dư khi ở lại Next.js 14.2.35

**Ngày:** 2026-08-21  
**Phiên bản Next.js hiện tại:** 14.2.35  
**Phiên bản mục tiêu:** 16.3.1 (latest 16.x)  
**Trạng thái:** FALLBACK — không thể nâng cấp do master branch thiếu file nguồn

---

## 1. Tóm tắt

Nâng cấp Next.js 14 → 16 bị **fallback** vì nhánh `master` (được dùng làm base cho worktree) thiếu **10+ file nguồn** và **20+ file test** trong `packages/core/src/` so với working directory hiện tại. Các file thiếu bao gồm:
- `list.ts`, `ledger.ts`, `init.ts`, `search.ts`, `khachhang.ts`, `ketoan.ts`, `baoduong.ts`, `mailer.ts` (domain logic mới)
- Các file test tương ứng

Kết quả: `npm run typecheck` fail ở `packages/core` do `Cannot find module './list.js'` v.v. — đây là lỗi **trước khi** nâng cấp Next.js, không phải do breaking changes của Next 16.

---

## 2. Rủi ro bảo mật của Next.js 14.2.35 (CVE/Advisory)

Next.js 14.2.35 có **2 high vulnerabilities** theo `npm audit` (transitive qua `next` + `postcss`):

| CVE / Advisory | Mức độ | Mô tả | Ảnh hưởng lên app này? |
|---|---|---|---|
| **GHSA-xvch-5gv4-9v4h** (next) | High | SSRF qua Image Optimization API khi `next.config.js` bật `images.remotePatterns` hoặc `domains` | **THẤP** — App không dùng `next/image` với remote domains; chạy intranet, không public-facing |
| **GHSA-7fh5-64p2-9v7j** (postcss) | High | ReDoS trong parser khi xử lý CSS độc hại | **THẤP** — Chỉ build-time; không xử lý CSS user-input |

> **Lưu ý:** Cả 2 CVE đều yêu cầu điều kiện đặc biệt (public-facing image optimizer / user-supplied CSS) — **app này triển khai intranet/LAN only**, không expose ra Internet, nên mặt bằng tấn công cực nhỏ.

---

## 3. Các breaking changes Next 16 đã chuẩn bị (đã fix trong worktree)

Nếu nâng cấp sau khi master sync đủ file, các thay đổi sau đã sẵn sàng:

| File | Thay đổi | Lý do |
|---|---|---|
| `apps/web/package.json` | `next: ^14.2.0` → `^16.3.1` | Nâng cấp chính |
| `apps/web/app/(app)/layout.tsx` | `cookies()` → `await cookies()` | Next 16: `cookies()`/`headers()`/`draftMode()` thành async |
| `apps/web/app/chat/file/[id]/route.ts` | `params: { id }` → `params: Promise<{ id }>` + `await params` | Next 15+: `params`/`searchParams` trong route handler thành Promise |

Không có breaking changes khác ảnh hưởng codebase (không dùng `searchParams` trong server component, không dùng `draftMode`).

---

## 4. Khuyến nghị

1. **Ưu tiên sync master với working directory** — commit các file mới (`packages/core/src/*.ts`, tests) vào `master` trước.
2. **Sau khi master xanh typecheck/test** — tái chạy upgrade Next 16 (worktree mới, cùng quy trình).
3. **Theo dõi advisory** — đăng ký GitHub Dependabot / `npm audit` định kỳ; nếu có CVE critical ảnh hưởng intranet (ví dụ RCE qua middleware/image), nâng cấp ngay.
4. **Mitigation tạm thời** — app chạy intranet, behind firewall, không public-facing → rủi ro thực tế **THẤP**. Có thể chấp nhận rủi ro này trong ngắn hạn (1-2 sprint) chờ sync master.

---

## 5. Lệnh verify sau khi master đã sync

```bash
# Từ thư mục dự án gốc
git worktree add -b next16-upgrade "../gara_v5_next16" master
Copy-Item .env.local "../gara_v5_next16/.env.local"
cd "../gara_v5_next16"
npm install
npm install next@16.3.1
npx tsc --noEmit        # phải 0 lỗi
npm run test:ci         # phải 236/236
npm run e2e             # phải pass
# Nếu xanh: git add -A && git commit -m "chore: upgrade Next.js 14->16"
```

---

## 6. Kết luận

- **Rủi ro thực tế của Next 14.2.35 trên app intranet này: THẤP**
- **Chặn upgrade: master branch chưa sync đủ file domain logic mới**
- **Hành động: Fallback an toàn, ghi nhận rủi ro, chờ master ready rồi upgrade lại**