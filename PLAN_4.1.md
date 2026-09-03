# PLAN_4.1 — Nâng cấp SaaS CencomOS v4.0 (GĐ-0 → GĐ-4)

> Mục tiêu: đưa hệ thống từ "chạy được" → "sản xuất SaaS an toàn, chịu tải, dễ mở rộng".
> Triển khai liên tục, không dừng hỏi. Kiểm tra cuối bởi user sau GĐ-4.

## GĐ-0 — Nền tảng abstraction (cả on-premise + cloud)
- `cache.ts`: CacheStore abstraction — Memory mặc định, Redis optional khi `REDIS_URL` (chia sẻ giữa instance serverless).
- `mailer.ts`: Mailer abstraction — Noop mặc định, SMTP optional khi `SMTP_HOST` (tự chứa, không ép cài nodemailer).
- Rate-limit login chuyển sang PG (`login_attempts`) thay Map in-memory (`auth.ts: loginBlockedPg/loginFailPg/loginResetPg`), wire vào `/api/auth`.

## GĐ-1 — Quản trị & vận hành
- Handlers: `userAdd/userSetPassword/userSetActive/userList` (auth), `permMatrix/permSave/roleOptions/thresholds/thresholdsSet` (perm), `currentUser/appInfo/myPerms/vehiclesOptions/phongbanList/checklistGroups/formInitData` (init), `auditList` (auth).
- Trang `/users` (tạo/sửa/khóa/đổi MK), `/audit` (nhật ký).
- Export Excel (`/api/export/[...]`, accept cookie) + In A4 (`/in/[type]/[id]`: sc/phxuat/dexuat/hoa_don).
- `CommandPalette` map route chuẩn.
- Backup on-premise (`Onpremise/scripts/backup.sh`, `restore.sh`) + cloud (`scripts/backup_cloud.sh`).

## GĐ-2 — Hiệu năng & chịu tải
- Sửa N+1: `phNhapList` (1 aggregate query), `deXuatList` (batch `xeByBks`).
- Phân trang thực: `scList/deXuatList/phNhapList/phXuatList/baoGiaList` trả `{rows, total, page, limit, pages}` + component `Pager` trên trang `sc/de-xuat/baogia`.
- `/api/rpc` chấp nhận cả object và array args (bọc thành `[args]`).

## GĐ-3 — UX & tìm kiếm
- Tìm kiếm toàn cục (`search.ts` + `globalSearch` + `GlobalSearch` trong Topbar): SC / xe / đề xuất.
- Thông báo: drill-down (click → route tương ứng) + realtime cập nhật badge (Supabase Realtime).
- UX primitives: `EmptyState` / `ErrorState` / `Skeleton`.
- PWA: `manifest.ts` + `public/sw.js` (network-first API, cache static) + `PwaRegister`.

## GĐ-4 — Nghiệp vụ gara VN (clone v3.6, giữ nguyên logic)
- Bảng `xe` bổ sung hồ sơ: chủ xe, số khung/số máy, ngày đăng ký, hạn đăng kiểm, hạn bảo hiểm.
- `xe.ts`: `xeList`(phân trang)/`xeGet`/`xeSave`/`xeReminders`. Trang `/xe`, `/xe/[bks]`, `/xe/new`, `/nhac-han`.
- `khachhang.ts`: `khachHangList/Get/Save/Del`. Trang `/khach-hang`.
- Báo giá → Hóa đơn: in `/in/hoa_don` (lấy items từ `dmDetail`).

## Rủi ro / chưa làm
- DB đã tồn tại cần chạy ALTER (đã có trong schema.sql, PG thường hỗ trợ `ADD COLUMN IF NOT EXISTS`; PGlite test warn-skip).
- Realtime cần Supabase được cấu hình (`NEXT_PUBLIC_SUPABASE_URL`/ANON_KEY).

## Cải thiện sau GĐ-4 (bổ sung theo đánh giá)
- **Pager + Skeleton cho Kho/vật tư**: `vatTuList` (kho.ts) hỗ trợ phân trang thực (`{page,limit,search}`) giữ backward-compat trả toàn bộ cho dropdown; `kho/page.tsx` gắn `Pager` + tìm kiếm server + `SkeletonList`/`EmptyState`/`ErrorState`.
- **Unit test bổ sung**: `tests/search.test.ts` (globalSearch: tìm SC/xe/đề xuất, rỗng, chưa login) + `tests/khachhang.test.ts` (tạo/cập nhật/từ chối thiếu tên/soft-delete). Core đạt **159/159 pass** (trước 152, thêm 7).
- **Migration on-premise GĐ-4**: `Onpremise/migrations/004_gd4.sql` (CREATE khach_hang + ALTER xe + index). `schema.sql` đã idempotent (CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS) nên chạy lại init_db cũng áp dụng được.
- **E2E Playwright**: `apps/web/e2e/` (playwright.config.ts, auth.setup.ts, flow.spec.ts: login→tạo xe→nhắc hạn→tạo chứng từ→in hóa đơn) + `run-e2e.ps1` orchestrate. *Chưa chạy trọn vẹn trong sandbox này do endpoint 5432 reset kết nối (không phải lỗi auth) — cần chạy trên môi trường có PG thực (on-premise/Supabase).*
- **Cấu hình Supabase thực**: cloud (Vercel) set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` từ project; on-premise `.env.onpremise` đã map `supabase-storage:54325` + `supabase-realtime:54324`. Realtime thông báo hoạt động khi biến này đúng.

## Cập nhật E2E thực tế (đã chạy thành công)
- E2E Playwright **đã chạy thực tế trên web + Postgres live (Supabase local stack 54322): 4/4 passed**, video tại pps/web/test-results/<test>/video.webm.
- 2 bug thật do E2E phát hiện & đã fix: (1) perm.permsOfRole('admin') -> {all:['all']} làm admin kẹt UI module (fix trả đủ module+feature); (2) xeSave INSERT chu_xe nhưng on-premise migration 004 thiếu cột (fix ALTER live + Onpremise/migrations/005_chu_xe.sql; schema.sql cloud đã có).
- Chi tiết từng đợt kiểm tra + video + verify DB: xem changelog_testfix.md.
