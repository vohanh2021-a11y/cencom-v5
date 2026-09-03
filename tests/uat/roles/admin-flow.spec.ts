/**
 * tests/uat/roles/admin-flow.spec.ts — UAT luồng nghiệp vụ chính (admin).
 * Tạo SC qua wizard 8 bước → xuất hồ sơ 9 tab (xlsx) phải trả 200.
 */
import { test, expect } from '@playwright/test';

test('admin tạo SC + xuất hồ sơ 9 tab (200)', async ({ page, request }) => {
  const role = test.info().project.name.replace('uat-', '');
  test.skip(role !== 'admin', 'chỉ admin chạy flow này');

  const bks = '51C-UAT' + Date.now().toString().slice(-5);
  await page.goto('/sc/create');
  await expect(page).toHaveURL(/\/sc\/create/);

  // Bước 1: thông tin chung
  await page.fill('input[placeholder="VD: 51C-12345"]', bks);
  await page.getByRole('button', { name: /Tiếp/ }).click();

  // Bước 2: công việc & vật tư (bỏ qua, có thể rỗng)
  await page.getByRole('button', { name: /Tiếp/ }).click();

  // Bước 3: xác nhận & tạo
  await page.getByRole('button', { name: /Tạo phiếu/ }).click();

  await page.waitForURL(/\/sc\/SC-/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/sc\/SC-/);

  const scId = page.url().match(/\/sc\/(SC-[^/]+)/)?.[1];
  expect(scId).toBeTruthy();

  // Xuất hồ sơ 9 tab
  const res = await request.get(`/api/export/sc-hoso/${scId}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type'] || '').toContain('spreadsheetml');
});
