import { test, expect } from '@playwright/test';

/**
 * E2E Full Flow (focused, robust selectors — UI has no name/id on inputs).
 * Steps: login → dashboard → /xe → add Xe → verify → logout.
 */
test('E2E: login → dashboard → create Xe → logout', async ({ page, baseURL }) => {
  const BASE = baseURL || 'http://localhost:3001';

  // 1. Login
  await page.goto(`${BASE}/login`);
  await expect(page.getByPlaceholder('Tài khoản')).toBeVisible();
  await page.getByPlaceholder('Tài khoản').fill('admin');
  await page.getByPlaceholder('Mật khẩu').fill('cencom@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // 2. Dashboard (admin stays on '/')
  await page.waitForURL(`${BASE}/`);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // 3. Go to Xe via nav
  await page.getByRole('link', { name: 'Xe' }).first().click();
  await expect(page.getByRole('heading', { name: 'Bảng xe' })).toBeVisible();

  // 4. Open "Thêm xe" modal
  await page.getByRole('button', { name: 'Thêm xe' }).click();
  await expect(page.getByRole('heading', { name: 'Thêm xe' })).toBeVisible();

  // 5. Fill form (inputs have only <label> siblings — use XPath)
  await page.locator('//label[contains(., "Biển số")]/following-sibling::input').fill('E2E-001');
  await page.locator('//label[contains(., "Chủ xe")]/following-sibling::input').fill('E2E Test');

  // 6. Save
  await page.getByRole('button', { name: 'Lưu' }).click();

  // 7. Verify save succeeded: modal closes (admin xeCreate sets is_test=1,
  //    so the new row is quarantined from xeList — we assert modal closed instead).
  await expect(page.getByRole('heading', { name: 'Thêm xe' })).toBeHidden({ timeout: 10000 });

  // 8. Logout
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.waitForURL(`${BASE}/login`);
  await expect(page.getByPlaceholder('Tài khoản')).toBeVisible();
});
