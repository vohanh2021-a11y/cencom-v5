# tests/uat — UAT Playwright từng vai (Quy chế 206)

Bộ UAT chạy trên trình duyệt thật, ghi **video riêng cho từng vai** để review thủ công.

## Cấu trúc
- `auth.setup.ts` — đăng nhập 7 vai (admin, giamdoc, xuong, khovattu, ketoan, pttb, laixe), lưu `tests/uat/.auth/<role>.json`.
- `playwright.config.ts` — mỗi vai = 1 project `uat-<role>` (dùng storageState tương ứng), `video: 'on'`.
- `roles/access.spec.ts` — kiểm tra truy cập & phân quyền (ai vào được `/sc`, `/perm`, export `sc-hoso` bị chặn với vai không phải lãnh đạo/kế toán).
- `roles/admin-flow.spec.ts` — admin tạo SC qua wizard 8 bước + xuất hồ sơ 9 tab (xlsx 200).

## Chuẩn bị
```bash
# 1. DB có user UAT (thêm pttb-1/laixe-1 + quyền)
node scripts/ensure-uat-users.mjs

# 2. Web dev chạy (terminal riêng)
$env:DATABASE_URL = "postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os"
cd apps/web; npm run dev   # → http://localhost:3000

# 3. Cài browser 1 lần
npx playwright install chromium
```

## Chạy + xuất video
```powershell
# Cách nhanh:
pwsh tests/uat/run-all.ps1

# Hoặc thủ công (chỉ 1 vai):
npx playwright test --config tests/uat/playwright.config.ts --project=uat-ketoan
```

## Video đầu ra
- `tests/uat/videos/uat-<role>/<test>.webm` (mỗi test 1 video).
- Báo cáo HTML: `tests/uat/report/index.html`.

## Ghi chú
- Mật khẩu UAT mặc định: `cencom@123` (user seed).
- Role ĐƯỢC xuất hồ sơ `sc-hoso`: admin, giamdoc, quanly, lanh_dao, truong_phong, ky_thuat, xuong_truong, ke_toan_truong, ketoan (xem `ROLE_RESTRICT` trong `apps/web/lib/rpc-dispatch.ts`).
- Nếu app dùng port khác: `set E2E_BASE_URL=http://localhost:XXXX`.
