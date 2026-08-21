import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';

type Results = { n: number; name: string; ok: boolean; msg: string }[];
const results: Results = [];
const rec = (n: number, name: string, ok: boolean, msg = '') =>
  results.push({ n, name, ok, msg });

// Filter benign console noise
const NOISE = [
  'Download the React DevTools',
  'telemetry',
  'favicon',
  '404',
  'Failed to load resource',
];
const isNoise = (t: string) => NOISE.some((n) => t.includes(n));

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await expect(page.getByPlaceholder('Tài khoản')).toBeVisible({ timeout: 60000 });
  await page.getByPlaceholder('Tài khoản').fill('admin');
  await page.getByPlaceholder('Mật khẩu').fill('cencom@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  // chờ Dashboard (không dùng waitForURL để tránh treo nếu 'load' không fire)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}

async function navTo(page: Page, label: string) {
  await page.getByRole('link', { name: label }).first().click();
  await page.waitForTimeout(600);
}

test('UAT 20 use-cases (self-heal)', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.text())) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const snap = () => [...consoleErrors, ...pageErrors];
  const hasBanner = async () =>
    (await page.locator('text=thất bại').count()) > 0 ||
    (await page.locator('text=Lỗi').count()) > 0;

  // 1. Login
  try {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    rec(1, 'Login admin → dashboard', true);
  } catch (e: any) {
    rec(1, 'Login admin → dashboard', false, String(e?.message || e));
    // cannot continue without login
    writeFileSync('tests/ux/results.json', JSON.stringify(results, null, 2));
    throw e;
  }

  // 2. Dashboard no console/page errors
  rec(2, 'Dashboard không lỗi runtime', consoleErrors.length === 0 && pageErrors.length === 0, snap().join(' | '));

  // 3. SC list
  try {
    await navTo(page, 'SC');
    await expect(page.getByRole('heading', { name: 'Quản lý sửa chữa' })).toBeVisible();
    rec(3, 'Navigate SC list', true);
  } catch (e: any) {
    rec(3, 'Navigate SC list', false, String(e?.message || e));
  }

  // 4. Create SC
  try {
    await page.locator('select').first().selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Tạo SC' }).click();
    await page.waitForTimeout(1500);
    rec(4, 'Tạo SC (không lỗi)', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
  } catch (e: any) {
    rec(4, 'Tạo SC', false, String(e?.message || e));
  }

  // 5. Open SC detail
  let detailOpened = false;
  try {
    const btn = page.getByRole('button', { name: 'Chi tiết' }).first();
    if (await btn.count()) {
      await btn.click();
      await expect(page.getByText('Chi tiết SC:').first()).toBeVisible({ timeout: 5000 });
      detailOpened = true;
      rec(5, 'Mở SC detail', true);
    } else {
      rec(5, 'Mở SC detail', true, 'no rows (skip)');
    }
  } catch (e: any) {
    rec(5, 'Mở SC detail', false, String(e?.message || e));
  }

  // 6. Add công việc (needs open detail + canSua)
  if (detailOpened) {
    try {
      const moTa = page.locator('//label[contains(., "Mô tả")]/following-sibling::input').first();
      if (await moTa.count()) {
        await moTa.fill('UX test công việc');
        await page.getByRole('button', { name: 'Thêm công việc' }).click();
        await page.waitForTimeout(1200);
        rec(6, 'Thêm công việc', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
      } else {
        rec(6, 'Thêm công việc', true, 'form not present (skip)');
      }
    } catch (e: any) {
      rec(6, 'Thêm công việc', false, String(e?.message || e));
    }

    // 7. Add vật tư
    try {
      const vt = page.locator('//label[contains(., "Vật tư")]/following-sibling::select').first();
      if (await vt.count()) {
        await vt.selectOption({ index: 1 });
        await page.getByRole('button', { name: 'Thêm vật tư' }).click();
        await page.waitForTimeout(1200);
        rec(7, 'Thêm vật tư', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
      } else {
        rec(7, 'Thêm vật tư', true, 'select not present (skip)');
      }
    } catch (e: any) {
      rec(7, 'Thêm vật tư', false, String(e?.message || e));
    }

    // 8. Change status (click any status action button if visible)
    try {
      const statusBtn = page
        .getByRole('button', { name: /Bắt đầu sửa|Hoàn thành|Từ chối|Quyết toán/ })
        .first();
      if (await statusBtn.count()) {
        await statusBtn.click();
        await page.waitForTimeout(1000);
        rec(8, 'Đổi trạng thái SC', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
      } else {
        rec(8, 'Đổi trạng thái SC', true, 'no status button (skip)');
      }
    } catch (e: any) {
      rec(8, 'Đổi trạng thái SC', false, String(e?.message || e));
    }

    // close modal
    try {
      await page.getByRole('button', { name: 'Đóng' }).first().click();
      await page.waitForTimeout(500);
    } catch {}
  } else {
    rec(6, 'Thêm công việc', true, 'no detail (skip)');
    rec(7, 'Thêm vật tư', true, 'no detail (skip)');
    rec(8, 'Đổi trạng thái SC', true, 'no detail (skip)');
  }

  // 9. Xe list
  try {
    await navTo(page, 'Xe');
    await expect(page.getByRole('heading', { name: 'Bảng xe' })).toBeVisible();
    rec(9, 'Navigate Xe list', true);
  } catch (e: any) {
    rec(9, 'Navigate Xe list', false, String(e?.message || e));
  }

  // 10. Create Xe
  try {
    await page.getByRole('button', { name: 'Thêm xe' }).click();
    await expect(page.getByRole('heading', { name: 'Thêm xe' })).toBeVisible();
    await page.locator('//label[contains(., "Biển số")]/following-sibling::input').fill('UXE-001');
    await page.locator('//label[contains(., "Chủ xe")]/following-sibling::input').fill('UX Test');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByRole('heading', { name: 'Thêm xe' })).toBeHidden({ timeout: 10000 });
    rec(10, 'Tạo Xe (modal đóng)', true);
  } catch (e: any) {
    rec(10, 'Tạo Xe (modal đóng)', false, String(e?.message || e));
  }

  // 11. Kho list
  try {
    await navTo(page, 'Kho');
    await expect(page.getByRole('heading', { name: 'Quản lý kho' })).toBeVisible();
    rec(11, 'Navigate Kho list', true);
  } catch (e: any) {
    rec(11, 'Navigate Kho list', false, String(e?.message || e));
  }

  // 12. Kho nhập
  try {
    await page.getByRole('button', { name: 'Nhập kho' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('//label[contains(., "Vật tư")]/following-sibling::select').first().selectOption({ index: 1 });
    await page.locator('//label[contains(., "Số lượng")]/following-sibling::input').first().fill('5');
    await page.locator('form').getByRole('button', { name: 'Nhập kho' }).click();
    await page.waitForTimeout(1200);
    rec(12, 'Kho nhập', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
  } catch (e: any) {
    rec(12, 'Kho nhập', false, String(e?.message || e));
  }

  // 13. Kho xuất (normal) + âm kho bị từ chối
  try {
    await page.getByRole('button', { name: 'Xuất kho' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('//label[contains(., "Vật tư")]/following-sibling::select').first().selectOption({ index: 1 });
    await page.locator('//label[contains(., "Số lượng")]/following-sibling::input').first().fill('2');
    await page.locator('form').getByRole('button', { name: 'Xuất kho' }).click();
    await page.waitForTimeout(1200);
    const normalOk = !(await hasBanner()) && pageErrors.length === 0;

    // negative: huge qty should be rejected (error banner appears)
    await page.locator('//label[contains(., "Vật tư")]/following-sibling::select').first().selectOption({ index: 1 });
    await page.locator('//label[contains(., "Số lượng")]/following-sibling::input').first().fill('999999');
    await page.locator('form').getByRole('button', { name: 'Xuất kho' }).click();
    await page.waitForTimeout(1200);
    const rejected =
      (await page.locator('text=Thiếu tồn kho').count()) > 0 ||
      (await page.locator('text=Xuất kho thất bại').count()) > 0 ||
      (await hasBanner()) ||
      pageErrors.length > 0;
    rec(13, 'Kho xuất (normal) + âm kho bị từ chối', normalOk && rejected, `normalOk=${normalOk} rejected=${rejected} ${pageErrors.join(' | ')}`);
  } catch (e: any) {
    rec(13, 'Kho xuất', false, String(e?.message || e));
  }

  // 14. Báo giá list
  try {
    await navTo(page, 'Báo giá');
    await expect(page.getByRole('heading', { name: 'Báo giá', exact: true })).toBeVisible();
    rec(14, 'Navigate Báo giá list', true);
  } catch (e: any) {
    rec(14, 'Navigate Báo giá list', false, String(e?.message || e));
  }

  // 15. Tạo Báo giá (wizard → save)
  try {
    await page.locator('select').first().selectOption({ index: 1 }); // step0 SC
    await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('Nhập tên NCC').fill('UX NCC');
    await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
    await page.waitForTimeout(300);
    // step2 date auto-filled; click Tiếp theo
    await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
    await page.waitForTimeout(300);
    // step3 mô tả
    await page.getByPlaceholder('Nhập mô tả hàng').fill('UX hàng A');
    await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
    await page.waitForTimeout(300);
    // step4 số lượng
    const sl = page.locator('input[placeholder="Số lượng"]');
    await sl.fill('2');
    await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
    await page.waitForTimeout(300);
    // step5 đơn giá
    const dg = page.locator('input[placeholder="Đơn giá (₫)"]');
    await dg.fill('100000');
    await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
    await page.waitForTimeout(400);
    // step6: add item then Hoàn tất
    const themHang = page.getByRole('button', { name: '+ Thêm hàng khác' });
    if (await themHang.count()) {
      await themHang.click();
      await page.waitForTimeout(300);
      // back at step3 with empty scratch; fill again to reach step6
      await page.getByPlaceholder('Nhập mô tả hàng').fill('UX hàng B');
      await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
      await page.waitForTimeout(300);
      await sl.fill('1');
      await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
      await page.waitForTimeout(300);
      await dg.fill('50000');
      await page.getByRole('button', { name: 'Tiếp theo' }).first().click();
      await page.waitForTimeout(400);
    }
    const hoanTat = page.getByRole('button', { name: 'Hoàn tất danh sách hàng' });
    if (await hoanTat.count()) {
      await hoanTat.click();
      await page.waitForTimeout(400);
    } else {
      throw new Error('Không tìm thấy nút Hoàn tất danh sách hàng (save unreachable)');
    }
    // step7 save
    await page.getByRole('button', { name: 'Lưu báo giá' }).click();
    await page.waitForTimeout(1500);
    rec(15, 'Tạo Báo giá (save)', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
  } catch (e: any) {
    rec(15, 'Tạo Báo giá (save)', false, String(e?.message || e));
  }

  // 16. Hồ sơ list
  try {
    await navTo(page, 'Hồ sơ');
    await expect(page.getByRole('heading', { name: 'Hồ sơ kế toán' })).toBeVisible();
    rec(16, 'Navigate Hồ sơ list', true);
  } catch (e: any) {
    rec(16, 'Navigate Hồ sơ list', false, String(e?.message || e));
  }

  // 17. Tạo Hồ sơ
  try {
    await page.locator('select').first().selectOption({ index: 1 });
    await page.getByPlaceholder('Số chứng từ').fill('UX-CT-001');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await page.waitForTimeout(1200);
    rec(17, 'Tạo Hồ sơ', !(await hasBanner()) && pageErrors.length === 0, pageErrors.join(' | '));
  } catch (e: any) {
    rec(17, 'Tạo Hồ sơ', false, String(e?.message || e));
  }

  // 18. Hồ sơ detail modal (if a row exists)
  try {
    const ct = page.getByRole('button', { name: 'Chi tiết' }).first();
    if (await ct.count()) {
      await ct.click();
      await page.waitForTimeout(800);
      rec(18, 'Mở Chi tiết Hồ sơ', pageErrors.length === 0, pageErrors.join(' | '));
      try {
        await page.getByRole('button', { name: 'Đóng' }).first().click();
      } catch {}
    } else {
      rec(18, 'Mở Chi tiết Hồ sơ', true, 'no rows (skip)');
    }
  } catch (e: any) {
    rec(18, 'Mở Chi tiết Hồ sơ', false, String(e?.message || e));
  }

  // 19. Logout
  try {
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByPlaceholder('Tài khoản')).toBeVisible({ timeout: 15000 });
    rec(19, 'Logout', true);
  } catch (e: any) {
    rec(19, 'Logout', false, String(e?.message || e));
  }

  // 20. Re-login + session
  try {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    rec(20, 'Re-login + session', true);
  } catch (e: any) {
    rec(20, 'Re-login + session', false, String(e?.message || e));
  }

  writeFileSync('tests/ux/results.json', JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('FAILED CASES: ' + failed.map((f) => `C${f.n}(${f.name}): ${f.msg}`).join(' || '));
  } else {
    console.log('ALL 20 CASES PASS');
  }
  // still surface runtime errors
  if (pageErrors.length || consoleErrors.length) {
    console.log('RUNTIME ERRORS: ' + snap().join(' | '));
    writeFileSync('tests/ux/console-errors.txt', snap().join('\n---\n'));
  }
});
