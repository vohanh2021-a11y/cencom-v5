# Next.js 14 → 16 Upgrade Plan — CencomOS Gara v5.0

**Tài liệu này:** Kế hoạch nâng cấp Next.js từ 14.2.x (LTS) lên 16.x (stable), khắc phục 25 CVE được phát hiện qua `npm audit --omit=dev`.

**Ngày tạo:** 2026-08-31
**Trạng thái:** Planned — chưa thực hiện (breaking changes lớn)
**Phiên bản hiện tại:** Next.js `^14.2.35` → **Mục tiêu:** Next.js `16.3.3+`

---

## 1. Tóm tắt CVE & Mức độ nghiêm trọng

Kết quả `npm audit --omit=dev` (2026-08-31):

| Package | Severity | Số CVE/Advisories | Vector chính |
|---------|----------|-------------------|--------------|
| `next` | **High** | 21 advisories (GHSA-*) | Image Optimizer DoS, RSC Deserialization DoS, HTTP Request Smuggling, Cache Poisoning, XSS, SSRF, Middleware Bypass, Server Actions DoS, Internal Endpoint Disclosure |
| `postcss` (transitive qua next) | **High** | 4 advisories | XSS via `</style>`, Arbitrary file read via sourceMappingURL, Path Traversal |

**Tổng cộng:** 25 CVE/Advisories (21 Next.js + 4 PostCSS)

### Danh sách CVE Next.js chi tiết (21 advisories)

| GHSA ID | CVE (nếu có) | Mô tả tóm tắt | Vector | Mitigation hiện tại |
|---------|--------------|---------------|--------|---------------------|
| GHSA-9g9p-9gw9-jx7f | CVE-2024-XXXXX | Image Optimizer DoS via `remotePatterns` | Self-hosted `/_next/image` | ✅ `images.unoptimized: true` (đã thêm) |
| GHSA-h25m-26qc-wcjf | CVE-2024-XXXXX | RSC HTTP Deserialization DoS | Server Components | ⬆️ Cần upgrade Next 15+ |
| GHSA-ggv3-7p47-pfv8 | CVE-2024-XXXXX | HTTP Request Smuggling in rewrites | `rewrites()` config | ⬆️ Cần upgrade Next 15+ |
| GHSA-3x4c-7xq6-9pq8 | CVE-2024-XXXXX | Unbounded Image disk cache growth | `/_next/image` cache | ✅ `images.unoptimized: true` |
| GHSA-q4gf-8mx6-v5v3 | CVE-2024-XXXXX | DoS with Server Components | RSC payload | ⬆️ Cần upgrade Next 15+ |
| GHSA-8h8q-6873-q5fj | CVE-2024-XXXXX | DoS with Server Components (variant) | RSC payload | ⬆️ Cần upgrade Next 15+ |
| GHSA-3g8h-86w9-wvmq | CVE-2024-XXXXX | Middleware/Proxy cache poisoning | `middleware.ts` redirects | ⬆️ Cần upgrade Next 15+ |
| GHSA-ffhc-5mcf-pf4q | CVE-2024-XXXXX | XSS in App Router CSP nonces | `nonce` + App Router | CSP config hiện tại KHÔNG dùng nonce → risk thấp |
| GHSA-vfv6-92ff-j949 | CVE-2024-XXXXX | Cache poisoning RSC cache-busting | RSC responses | ⬆️ Cần upgrade Next 15+ |
| GHSA-gx5p-jg67-6x7h | CVE-2024-XXXXX | XSS in `beforeInteractive` scripts | `next/script` strategy | App không dùng `beforeInteractive` → risk thấp |
| GHSA-h64f-5h5j-jqjh | CVE-2024-XXXXX | DoS in Image Optimization API | `/_next/image` endpoint | ✅ `images.unoptimized: true` |
| GHSA-c4j6-fc7j-m34r | CVE-2024-XXXXX | SSRF in WebSocket upgrades | Custom server + WS | App KHÔNG dùng custom server WS → risk thấp |
| GHSA-wfc6-r584-vfw7 | CVE-2024-XXXXX | Cache poisoning RSC responses | RSC cache | ⬆️ Cần upgrade Next 15+ |
| GHSA-36qx-fr4f-26g5 | CVE-2024-XXXXX | Middleware bypass Pages Router i18n | `i18n` config | App dùng App Router, KHÔNG dùng i18n → risk thấp |
| GHSA-m99w-x7hq-7vfj | CVE-2024-XXXXX | DoS in App Router Server Actions | Server Actions payload | ⬆️ Cần upgrade Next 15+ |
| GHSA-89xv-2m56-2m9x | CVE-2024-XXXXX | SSRF in Server Actions custom server | Custom server | App dùng `output: standalone` (Node server) → risk trung bình |
| GHSA-68g3-v927-f742 | CVE-2024-XXXXX | Cache confusion response bodies | Request với body | ⬆️ Cần upgrade Next 15+ |
| GHSA-4633-3j49-mh5q | CVE-2024-XXXXX | Cache confusion invalid UTF-8 | Request invalid UTF-8 | ⬆️ Cần upgrade Next 15+ |
| GHSA-4c39-4ccg-62r3 | CVE-2024-XXXXX | Unbounded Server Action payload Edge | Edge runtime | App KHÔNG dùng Edge runtime → risk thấp |
| GHSA-p9j2-gv94-2wf4 | CVE-2024-XXXXX | SSRF in rewrites attacker hostname | `rewrites()` destination | App KHÔNG dùng rewrites động → risk thấp |
| GHSA-955p-x3mx-jcvp | CVE-2024-XXXXX | Unauthenticated internal endpoint disclosure | Server Functions | ⬆️ Cần upgrade Next 15+ |

### Danh sách CVE PostCSS (4 advisories — transitive)

| GHSA ID | Mô tả | Vector | Mitigation |
|---------|-------|--------|------------|
| GHSA-qx2v-qp2m-jg93 | XSS via unescaped `</style>` | CSS stringify | Upgrade postcss ≥ 8.5.23 (kèm Next 16) |
| GHSA-6g55-p6wh-862q | Arbitrary file read via sourceMappingURL | CSS comments | Upgrade postcss ≥ 8.5.23 |
| GHSA-fxqj-rqcc-2cmp | Incomplete fix previous | sourceMappingURL | Upgrade postcss ≥ 8.5.23 |
| GHSA-r28c-9q8g-f849 | Path traversal source map auto-load | `.map` files | Upgrade postcss ≥ 8.5.23 |

---

## 2. Mitigations ĐÃ ÁP DỤNG (Immediate — No Breaking Changes)

### 2.1 `images.unoptimized: true` — **ĐÃ THÊM vào `gara_reconstruction_v5/next.config.js`**

```javascript
// next.config.js
images: {
  unoptimized: true,
},
```

**Tác động:**
- ✅ Loại bỏ hoàn toàn Image Optimization API (`/_next/image`) → chặn 3 CVE DoS liên quan (GHSA-9g9p-9gw9-jx7f, GHSA-h64f-5h5j-jqjh, GHSA-3x4c-7xq6-9pq8)
- ✅ Không cần image server / sharp / disk cache
- ⚠️ Trade-off: ảnh KHÔNG được optimize tự động (resize, WebP/AVIF, lazy-load blur placeholder). Client nhận ảnh gốc.
- ✅ Phù hợp on-premise / standalone (không có Vercel Image CDN)

**Verify:** Build thành công, không lỗi TypeScript, ảnh vẫn hiển thị (qua `<img>` thường hoặc `next/image` với `unoptimized` prop).

---

## 3. Kế hoạch Nâng cấp Next.js 14 → 16 (Breaking Changes)

> ⚠️ **CẢNH BÁO:** Next 15+ có breaking changes LỚN. Upgrade phải theo quy trình **TDD + Canary + Staging** — không deploy production trực tiếp.

### 3.1 Phân tích Breaking Changes chính (Next 15 → 16)

| Thay đổi | Tác động CencomOS Gara | Migration effort |
|----------|------------------------|------------------|
| **React 19** (peer dep) | `@types/react` 18 → 19, `react` 18 → 19, `react-dom` 18 → 19 | Cao: test toàn bộ UI, check `use` hook, `useActionState`, form actions |
| **Turbopack default** | `next dev` dùng Turbopack | Thấp: verify `next dev` chạy OK |
| **`next/image` default `unoptimized=false`** | Đã set `unoptimized: true` → OK | Không |
| **Server Actions payload limit** | App dùng Server Actions? (Check) | Trung bình: config `serverActions.bodySizeLimit` |
| **Middleware response size limit** | `middleware.ts` có redirect/rewrite | Thấp: check response size |
| **`experimental.instrumentationHook`** → stable | Đã dùng `instrumentationHook: true` | Verify API ổn định |
| **Cache API changes** | `revalidatePath`, `revalidateTag` behavior | Cao: audit tất cả revalidation |
| **App Router: `unstable_cache` → `cache`** | Nếu dùng `unstable_cache` | Tìm & replace |
| **Edge Runtime changes** | App KHÔNG dùng Edge | Không |
| **TypeScript config stricter** | `tsc --noEmit` có thể fail | Fix type errors |

### 3.2 Dependency Matrix (Upgrade đồng bộ)

| Package | Current | Target | Note |
|---------|---------|--------|------|
| `next` | `^14.2.35` | `16.3.3` | **Core upgrade** |
| `react` | `18` | `19` | **Breaking** — peer dep của Next 16 |
| `react-dom` | `18` | `19` | **Breaking** |
| `@types/react` | `^18` | `^19` | **Breaking** |
| `@types/react-dom` | `^18` | `^19` | **Breaking** |
| `typescript` | `5` | `5.6+` | Next 16 yêu cầu TS 5.6+ |
| `eslint-config-next` | `^16.3.3` | `16.x` | Align với Next 16 |
| `tailwindcss` | `3` | `3.4+` | Compatible |
| `postcss` | `^8.4.47` | `^8.5.23` | Fix 4 CVE PostCSS |
| `autoprefixer` | `^10.4.20` | `^10.4.20+` | Compatible |
| `pg` | `8` | `8.11+` | No breaking |
| `zod` | `3` | `3.23+` | Compatible |
| `@playwright/test` | `^1.62.1` | `^1.48+` | Compatible |
| `jest` | `^30.4.2` | `^29.7` / `^30` | Check TS config |
| `ts-jest` | `^29.4.12` | `^29.2` | Compatible |
| `tsx` | `^4.19.1` | `^4.19+` | Compatible |

---

## 4. Quy trình Upgrade — 5 Giai đoạn (TDD-enforced)

### Giai đoạn 0: Baseline & Lockfile (✅ ĐÃ CÓ)
- `package-lock.json` commit sạch
- `npm audit --omit=dev` baseline: **2 high** (next + postcss)
- Conformance test: **≥320 pass** (`npm run test:conformance`)
- Type check: `tsc --noEmit` pass

### Giai đoạn 1: Canary Branch — Next 15 RC (2-3 ngày)
```bash
git checkout -b upgrade/next-15-canary
npm install next@15.4.0-canary.XX react@19.0.0-rc react-dom@19.0.0-rc @types/react@19 @types/react-dom@19 typescript@5.6 --legacy-peer-deps
```
**Gates:**
- [ ] `npm run build` pass (standalone output)
- [ ] `npm run tsc` pass
- [ ] `npm run test:conformance` ≥ 300 pass (cho phép giảm tạm)
- [ ] `npm run lint` pass
- [ ] Smoke test manual: login, SC list, phiếu SC, báo giá, kho, tài khoản

### Giai đoạn 2: Next 16 Stable + React 19 Stable (3-5 ngày)
```bash
git checkout -b upgrade/next-16-stable
npm install next@16.3.3 react@19 react-dom@19 @types/react@19 @types/react-dom@19 typescript@5.6 postcss@8.5.23 --legacy-peer-deps
```
**Fix breaking changes thường gặp:**
1. **React 19 types:** `React.FC` → `ComponentType`, `JSX.Element` → `React.ReactElement`
2. **Server Actions:** thêm `serverActions: { bodySizeLimit: '2mb' }` vào `next.config.js`
3. **Middleware:** response size limit 1MB → tăng nếu cần `middleware: { responseLimit: '2mb' }`
4. **Cache:** `unstable_cache` → `cache` (import from `next/cache`)
5. **Forms:** `<form action={async () => {} }>` thay vì `onSubmit` cho Server Actions

**Gates:**
- [ ] `npm run build` pass
- [ ] `npm run tsc` pass (0 error)
- [ ] `npm run test` pass (unit)
- [ ] `npm run test:conformance` **≥ 320 pass** (full parity)
- [ ] `npm run e2e` pass (Playwright critical flows)
- [ ] `npm audit --omit=dev` → **0 high** (verify)

### Giai đoạn 3: Staging Deploy & Load Test (2 ngày)
- Deploy lên staging on-premise (Docker compose)
- Chạy k6 load test: 50 VUs, 5 phút, check p95 < 500ms, error rate < 0.1%
- Security scan: `npm audit`, OWASP ZAP baseline
- UAT checklist: 20 case từ `docs/UX_20CASE_REPORT.md`

### Giai đoạn 4: Production Cutover (1 ngày)
- Blue-green deploy hoặc rolling update Docker
- Monitor: error rate, p99 latency, memory/CPU
- Rollback plan: `docker-compose down && docker-compose up -d` (image trước)

---

## 5. File Cần Sửa Khi Upgrade (Checklist)

| File | Thay đổi dự kiến |
|------|------------------|
| `package.json` | Version bump all deps |
| `next.config.js` | Thêm `serverActions.bodySizeLimit`, `middleware.responseLimit`, bỏ `experimental.instrumentationHook` nếu stable |
| `tsconfig.json` | `lib: ["ES2023", "DOM", "DOM.Iterable"]` → check React 19 types |
| `middleware.ts` | Check response size, `NextResponse.redirect` pattern |
| `lib/rpc.ts` / Server Actions | Add `'use server'` directive, validate payload size |
| `app/**/*.tsx` | Fix React 19 type errors, `use` hook migration |
| `jest.config.js` | Update `transform` cho TS 5.6+ |
| `playwright.config.ts` | Update baseURL nếu port đổi |

---

## 6. Rollback Plan

Nếu upgrade thất bại tại bất kỳ giai đoạn nào:

```bash
# 1. Quay về branch main
git checkout main

# 2. Restore lockfile
git checkout HEAD -- package-lock.json

# 3. Reinstall
npm ci

# 4. Rebuild
npm run build

# 5. Deploy lại image cũ (Docker tag trước)
docker-compose down
docker tag gara_v5:latest gara_v5:rollback-$(date +%s)
docker-compose up -d
```

**RTO (Recovery Time Objective):** < 15 phút
**RPO (Recovery Point Objective):** 0 (stateless app, DB không đổi schema)

---

## 7. Testing Strategy — Conformance & Regression

### 7.1 Conformance Tests (Bắt buộc ≥ 320 pass)
```bash
npm run test:conformance
```
Cover: SC lifecycle, báo giá, kho, tài khoản, auth, role-perm, realtime sync.

### 7.2 Unit Tests (Jest)
```bash
npm run test
```
Focus: `lib/core/*` (business logic: hồ sơ, báo giá, SC, kho, scoring).

### 7.3 E2E Tests (Playwright)
```bash
npm run e2e
```
Critical paths:
1. Login → Dashboard
2. Tạo SC → Phê duyệt → In phiếu
3. Tạo báo giá → Xuất HTML A4
4. Nhập kho → Xuất kho → Kiểm kê
5. Quản lý tài khoản → Phân quyền

### 7.4 Security Tests
- `npm audit --omit=dev` → 0 high
- OWASP ZAP baseline scan staging
- CSP header verification (`curl -I`)

---

## 8. Timeline & Resource Estimate

| Giai đoạn | Thời gian | Nhân lực | Risk |
|-----------|-----------|----------|------|
| 0: Baseline | 0.5 ngày | 1 dev | Thấp |
| 1: Canary | 2-3 ngày | 1-2 dev | Trung bình |
| 2: Stable + Fix | 3-5 ngày | 2 dev | **Cao** |
| 3: Staging + Load | 2 ngày | 1 dev + 1 QA | Trung bình |
| 4: Production | 1 ngày | 1 dev + 1 ops | Thấp (có rollback) |
| **Tổng** | **9-12 ngày** | **2-3 dev** | |

---

## 9. Production Check — ⚠️ Lưu ý hệ thống sản xuất

1. **Con thiếu gì?**
   - Chưa có test matrix React 19 (cần tạo test case cho `use` hook, form actions, Server Actions mới)
   - Chưa verify `next.config.js` production CSP nonce strategy (hiện dùng `unsafe-inline`)
   - Chưa có k6 load test script chính thức (cần viết)

2. **Rủi ro nằm ở đâu?**
   - React 19 breaking changes gây build fail / runtime error ở components phức tạp
   - Server Actions payload limit chặn file upload lớn (báo giá đính kèm ảnh)
   - Middleware response size limit chặn redirect với query string dài
   - Cache behavior thay đổi gây stale data trên SC list / kho realtime

3. **Đã chạy kiểm thử chưa?**
   - ✅ Baseline audit: 2 high (next, postcss)
   - ✅ `images.unoptimized: true` mitigation applied
   - ❌ Next 15/16 canary build test — **CHƯA**
   - ❌ Conformance test trên Next 16 — **CHƯA**
   - ❌ Load test staging — **CHƯA**

4. **Đề xuất cải thiện / lỗ hổng tiếp theo:**
   - **Ưu tiên 1:** Tạo branch `upgrade/next-16` và chạy canary build ngay
   - **Ưu tiên 2:** Viết k6 script cho load test (`scripts/load-test.js`)
   - **�Ưu tiên 3:** Harden CSP: thêm nonce cho script/style, bỏ `unsafe-eval` production
   - **Ưu tiên 4:** Thêm `serverActions.bodySizeLimit: '5mb'` cho upload ảnh báo giá
   - **Ưu tiên 5:** Cân nhắc upgrade `@playwright/test` latest để tránh flaky

---

## 10. Quick Reference — Commands

```bash
# Audit hiện tại
cd gara_reconstruction_v5 && npm audit --omit=dev

# Canary install (Next 15 RC)
npm install next@15.4.0-canary.XX react@19.0.0-rc react-dom@19.0.0-rc @types/react@19 @types/react-dom@19 typescript@5.6 --legacy-peer-deps

# Stable install (Next 16)
npm install next@16.3.3 react@19 react-dom@19 @types/react@19 @types/react-dom@19 typescript@5.6 postcss@8.5.23 --legacy-peer-deps

# Verify gates
npm run build && npm run tsc && npm run test:conformance && npm run e2e

# Audit sau upgrade
npm audit --omit=dev
```

---

## 11. Appendix: CVE Mapping to Mitigations

| CVE Category | Mitigation Applied | Status |
|--------------|-------------------|--------|
| Image Optimizer DoS (3 CVEs) | `images.unoptimized: true` | ✅ Done |
| RSC Deserialization DoS (2 CVEs) | Upgrade Next 16 | ⏳ Planned |
| HTTP Request Smuggling | Upgrade Next 16 | ⏳ Planned |
| Cache Poisoning (3 CVEs) | Upgrade Next 16 | ⏳ Planned |
| XSS (2 CVEs) | CSP headers + Upgrade Next 16 | 🟡 Partial |
| SSRF (2 CVEs) | No custom server WS/rewrites + Upgrade | 🟡 Partial |
| Middleware Bypass | No i18n + Upgrade | 🟡 Partial |
| Server Actions DoS (2 CVEs) | Upgrade + config bodySizeLimit | ⏳ Planned |
| Internal Endpoint Disclosure | Upgrade Next 16 | ⏳ Planned |
| PostCSS XSS/File Read (4 CVEs) | Upgrade postcss 8.5.23 (via Next 16) | ⏳ Planned |

---

**End of Document** — Next review: sau khi canary build pass (Giai đoạn 1)