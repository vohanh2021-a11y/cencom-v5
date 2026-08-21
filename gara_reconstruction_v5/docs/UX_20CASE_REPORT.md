# BÁO CÁO UAT 20 USE-CASE (SELF-HEAL) — GIAI ĐOẠN 3

**Dự án:** cencomOS Gara v5 (greenfield, Next.js 14 App Router + PostgreSQL)
**Ngày:** 2026-08-21
**Người thực thi:** Orchestrator (P3-F chạy trực tiếp sau khi 2 sub-agent trả về rỗng)
**Môi trường test:** Server production (`next start -p 3003`), Chromium (Playwright), tài khoản admin (`cencom@123`).

---

## 1. Mục tiêu

Thực hiện **20 use-case UX đầu-cuối** bao phủ toàn bộ luồng nghiệp vụ chính
(SC → công việc/vật tư → đổi trạng thái → Kho nhập/xuất → Báo giá → Hồ sơ →
Đăng xuất/Đăng nhập lại), vừa để **xác nhận hệ thống dùng được**, vừa để **tự động
phát hiện & sửa các lỗi UX/luồng** (cơ chế self-healing).

## 2. Phương pháp

- Server chạy độc lập (`next start` trên port 3003) — không đụng với dev server.
- Playwright chạy 1 kịch bản duy nhất (`tests/ux/ux-20.spec.ts`) đi tuần tự 20
  bước, mỗi bước ghi nhận `ok`/`msg` vào `tests/ux/results.json`.
- Thu thập `console error` + `pageerror` trong suốt phiên; nếu có thì ghi ra
  `tests/ux/console-errors.txt`.
- Với mỗi lỗi gặp phải: đọc source liên quan → sửa → chạy lại → lặp tối đa 3 lần.

## 3. Kết quả cuối cùng

| Chỉ số | Giá trị |
|---|---|
| Tổng số case | 20 |
| **PASS** | **20 / 20** |
| FAIL | 0 |
| Console error | **0** |
| Page error (uncaught) | **0** |
| Thời gian chạy | ~23–38s / lượt |
| Build production | ✅ thành công (`npm run build`) |
| `tsc --noEmit` | ✅ sạch (được build kiểm tra) |

> Đợt chạy cuối (sau khi sửa toàn bộ lỗi) sinh `console-errors.txt` **rỗng** —
> tức không còn bất kỳ cảnh báo/hydration error nào.

## 4. Các lỗi ĐÃ TÌM THẤY & TỰ SỬA (5 lỗi)

| # | Triệu chứng | Nguyên nhân gốc | File sửa | Cách sửa |
|---|---|---|---|---|
| 1 | **API toàn bộ trả 500** (`SASL: client password must be a string`) | `.env.local` lưu dạng **UTF-16** → Next.js không parse được `DATABASE_URL` → `pg.Pool` nhận undefined | `.env.local` | Ghi lại UTF-8 không BOM (giữ `DATABASE_URL`, `SESSION_SECRET`). |
| 2 | Trang `/api/*` treo / instrumentation crash `process.on is not a function` | `lib/observability.ts` gọi `process.on` trong ngữ cảnh Next instrumentation (không có `process`) | `lib/observability.ts` | Thêm guard `if (typeof process==='undefined' \|\| typeof process.on!=='function') return;` |
| 3 | **Infinite render loop** (`Maximum update depth exceeded`) ở `ScDetailModal` và mọi trang dùng `useApi` trong `useEffect` | `useApi()` trả về **object mới mỗi render** → `useCallback([api,...])` đổi reference → effect chạy vô hạn | `lib/hooks/useApi.ts` | Trả về object **stable** qua `useRef` (chỉ cập nhật `loading`/`error` mỗi render, `call` giữ nguyên). |
| 4 | **Không thể lưu Báo giá** — nút "Hoàn tất danh sách hàng" không bao giờ hiện | `baogia/page.tsx` chỉ render bước 6 khi `!canAddMore`, nhưng để tới bước 6 phải hoàn tất item → **đụng nhau** → save không bao giờ reachable | `app/(app)/baogia/page.tsx` | Bước 6 luôn hiện khi `form.items.length>0`; nút "+ Thêm hàng khác" hiện khi `canAddMore`. |
| 5 | **Hydration warning** `<tr> không thể là con của <section>` (React dev overlay) | `SkeletonRow` (trả về `<tr>`) được đặt trực tiếp trong `<section>` ở `ScDetailModal` (2 chỗ loading) | `app/(app)/sc/page.tsx` | Bọc `<SkeletonRow>` trong `<table><tbody>` khi hiển thị skeleton. |

Ngoài ra, trong quá trình viết test đã phát hiện **3 lỗi selector của chính kịch bản
test** (không phải lỗi app) và đã sửa: nút "Nhập kho"/"Xuất kho" trùng label (tab vs
submit) → dùng `form` scope; heading "Báo giá" khớp nhầm 3 heading → dùng `exact:true`;
kiểm tra bản lỗi kho dùng text cụ thể `"Thiếu tồn kho"` thay vì chỉ đỏ/amber chung.

## 5. Danh sách 20 use-case

| # | Use-case | Kết quả |
|---|---|---|
| 1 | Login admin → dashboard | ✅ |
| 2 | Dashboard không lỗi runtime | ✅ |
| 3 | Navigate SC list | ✅ |
| 4 | Tạo SC (không lỗi) | ✅ |
| 5 | Mở SC detail | ✅ |
| 6 | Thêm công việc | ✅ |
| 7 | Thêm vật tư | ✅ |
| 8 | Đổi trạng thái SC | ✅ |
| 9 | Navigate Xe list | ✅ |
| 10 | Tạo Xe (modal đóng) | ✅ |
| 11 | Navigate Kho list | ✅ |
| 12 | Kho nhập (modal đóng, không lỗi) | ✅ |
| 13 | Kho xuất (normal OK) + **âm kho bị từ chối** ("Thiếu tồn kho") | ✅ |
| 14 | Navigate Báo giá list | ✅ |
| 15 | Tạo Báo giá (save thành công) | ✅ |
| 16 | Navigate Hồ sơ list | ✅ |
| 17 | Tạo Hồ sơ | ✅ |
| 18 | Mở Chi tiết Hồ sơ | ✅ |
| 19 | Logout | ✅ |
| 20 | Re-login + session còn hiệu lực | ✅ |

> Case 13 xác nhận logic nghiệp vụ đúng: xuất 999999 khi tồn ≤3 bị server từ chối
> (`kho.xuatKho` check `ton < soLuong` → ném `'Thiếu tồn kho'`), không cho âm kho.

## 6. Kết luận & khuyến nghị

- **Hệ thống v5 dùng được đầu-cuối** trên 20 luồng chính, không lỗi runtime.
- Cơ chế **self-heal** phát hiện & sửa được **5 lỗi thực** (1 root-cause env, 1 crash,
  1 infinite-loop, 1 luồng nghiệp vụ kẹt, 1 hydration) — tất cả đều có bằng chứng
  verify lại 20/20 + 0 console error.
- **Khuyến nghị tiếp theo:** (a) bổ sung unit test cho `useApi` (stable ref) và
  `kho.xuatKho` (stock check); (b) chạy `tests/conformance` (≥320 case) để đóng GĐ3;
  (c) commit toàn bộ GĐ3 (P3-A…P3-F) khi duyệt.

## 7. File liên quan

- `tests/ux/ux-20.spec.ts` — kịch bản 20 case
- `playwright.ux.config.ts` — config (testDir `./tests/ux`, timeout 180s)
- `tests/ux/results.json` — kết quả từng case (20 ok:true)
- `tests/ux/console-errors.txt` — rỗng (không lỗi)
- Sửa: `.env.local`, `lib/observability.ts`, `lib/hooks/useApi.ts`,
  `app/(app)/baogia/page.tsx`, `app/(app)/sc/page.tsx`
