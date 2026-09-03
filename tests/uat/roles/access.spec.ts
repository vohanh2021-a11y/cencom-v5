/**
 * tests/uat/roles/access.spec.ts — UAT truy cập & phân quyền từng vai (QC206).
 * Chạy trong mỗi project uat-<role> (đã login sẵn qua storageState).
 *
 * Các role ĐƯỢC xuất hồ sơ sc-hoso: admin, giamdoc, quanly, lanh_dao, truong_phong,
 * ky_thuat, xuong_truong, ke_toan_truong, ketoan (xem ROLE_RESTRICT trong rpc-dispatch).
 */
import { test, expect } from '@playwright/test';

// Role được phép tải toàn bộ hồ sơ (có chi phí)
const EXPORT_ALLOW = ['admin', 'giamdoc', 'quanly', 'lanh_dao', 'truong_phong', 'ky_thuat', 'xuong_truong', 'ke_toan_truong', 'ketoan'];

function roleOf() {
  return test.info().project.name.replace('uat-', '');
}

test('mọi vai truy cập được danh sách SC (/sc)', async ({ page }) => {
  await page.goto('/sc');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('.page-head, h1')).toBeVisible();
});

test('xuất hồ sơ sc-hoso: chỉ vai được phép mới không bị 403', async ({ request }) => {
  const role = roleOf();
  const res = await request.get('/api/export/sc-hoso/SC-TEST-XYZ');
  if (EXPORT_ALLOW.includes(role)) {
    // leadership: được qua phân quyền (sẽ là 200 nếu SC tồn tại, hoặc 400 nếu thiếu id) — KHÔNG phải 403
    expect(res.status()).not.toBe(403);
  } else {
    // vai khác: bị chặn (role restricted / report.xem)
    expect(res.status()).toBe(403);
  }
});

test('/perm chỉ admin mới vào được', async ({ page }) => {
  const role = roleOf();
  await page.goto('/perm');
  if (role === 'admin') {
    await expect(page).not.toHaveURL(/\/login/);
  } else {
    // bị chặn → quay về login (hoặc hiện thông báo). Chấp nhận 1 trong 2.
    await expect(page).toHaveURL(/\/login/).catch(async () => {
      await expect(page.locator('text=/không có quyền|forbidden/i')).toBeVisible();
    });
  }
});

test('Dashboard QC206 (/sc/dashboard) hiển thị cho vai có sc.xem', async ({ page }) => {
  const role = roleOf();
  await page.goto('/sc/dashboard');
  if (role === 'laixe') {
    // laixe có sc.xem → vẫn xem được (dashboard là xem)
    await expect(page).not.toHaveURL(/\/login/);
  } else {
    await expect(page).not.toHaveURL(/\/login/);
  }
});
