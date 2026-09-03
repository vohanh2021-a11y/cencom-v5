/**
 * tests/e2e/e2e-flow.test.ts — Playwright E2E test full user flow: xe → SC → công việc → vật tư → báo giá → hồ sơ
 * Chạy: npx playwright test tests/e2e/e2e-flow.test.ts --project=chromium
 * Yêu cầu: Web server đang chạy tại TEST_BASE_URL (mặc định http://localhost:3001)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

test.describe('E2E Full Flow — Xe → SC → Công việc → Vật tư → Báo giá → Hồ sơ', () => {
  test('full user flow: login → dashboard → xe → sc → công việc → vật tư → báo giá → hồ sơ → logout', async ({ page }) => {
    // =========================================================================
    // 1. Login
    // =========================================================================
    await page.goto(`${BASE_URL}/login`);

    // Fill login form: admin / cencom@123
    await page.fill('input[placeholder="Tài khoản"]', 'admin');
    await page.fill('input[type="password"]', 'cencom@123');

    // Submit form và chờ redirect
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForURL(`${BASE_URL}/`, { timeout: 5000 })
    ]);

    // Verify redirect thành công
    await expect(page).toHaveURL(`${BASE_URL}/`);
    // Dashboard hiển thị text "Tổng quan" hoặc metric
    await expect(page.locator('text=Tổng quan')).toBeVisible({ timeout: 3000 });

    // =========================================================================
    // 2. Dashboard check - already verified above
    // =========================================================================

    // =========================================================================
    // 3. /xe — Thêm xe mới
    // =========================================================================
    // Click "Thêm xe"
    await page.click('button:has-text("Thêm xe")');
    await expect(page).toHaveURL(`${BASE_URL}/xe`);

    // Fill form: biển số, chủ xe, năm, nguyên giá
    // Inputs are controlled React components with placeholder text
    await page.fill('input[placeholder="Biển số"]', '30A12345');
    await page.fill('input[placeholder="Chủ xe"]', 'Nguyễn Văn A');
    await page.fill('input[placeholder="Năm sản xuất"]', '2023');
    await page.fill('input[placeholder="Nguyên giá"]', '500000000');

    // Submit form
    await Promise.all([
      page.click('button:has-text("Lưu")'),
      page.waitForResponse(`**/api/rpc`),
    ]);

    // Verify row xuất hiện trong danh sách xe (check by biển số)
    await expect(page.locator('td').filter({ hasText: '30A12345' })).toBeVisible({ timeout: 5000 });

    // =========================================================================
    // 4. /sc — Tạo phiếu sửa chữa
    // =========================================================================
    // Click "Tạo phiếu"
    await page.click('text=Tạo phiếu');
    await expect(page).toHaveURL(`${BASE_URL}/sc`);

    // Chọn xe vừa tạo từ dropdown
    // Dropdown options: <option value={x.id}>{x.bien_so} — {x.chu_xe || ''}</option>
    await page.selectOption('select', { label: '30A12345' });

    // Ngày hôm nay
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[type="date"]', today);

    // Submit
    await Promise.all([
      page.click('button:has-text("Tạo SC")'),
      page.waitForResponse(`**/api/rpc`),
    ]);

    // Verify SC ở trạng thái "Đề xuất" (de_xuat)
    // Status chip: <span>Đề xuất</span>
    await expect(page.locator('span').filter({ hasText: 'Đề xuất' })).toBeVisible({ timeout: 5000 });

    // Extract SC ID from the table row
    // SC rows: <td className="px-3 py-2 font-mono">{s.id}</td>
    const scRow = page.locator('tr').filter({ has: page.locator('td').filter({ hasText: /SC-\d+/ }) }).first();
    const scIdText = await scRow.textContent();
    const actualScId = scIdText?.trim().replace('SC-', '') || '1';

    // =========================================================================
    // 5. Click vào SC → trang chi tiết → "Thêm công việc"
    // =========================================================================
    await page.click(`text=SC-${actualScId}`);
    await expect(page).toHaveURL(`${BASE_URL}/sc/${actualScId}`);

    // "Thêm công việc" → fill mô tả, loại xử lý "sua_chua", SL, đơn giá
    await page.fill('input[placeholder="Mô tả công việc"]', 'Sửa động cơ');
    // Loại xử lý là select: <select value={cvLoai} onChange={(e) => setCvLoai(e.target.value)}>
    await page.selectOption('select', 'sua_chua');
    await page.fill('input[placeholder="Số lượng"]', '1');
    await page.fill('input[placeholder="Đơn giá"]', '500000');

    await Promise.all([
      page.click('button:has-text("Thêm công việc")'),
      page.waitForResponse(`**/api/rpc`),
    ]);

    // =========================================================================
    // 6. "Bắt đầu sửa" → verify trạng thái "Đang sửa"
    // =========================================================================
    await page.click('button:has-text("Bắt đầu sửa")');
    await page.waitForResponse(`**/api/rpc`);
    // Status chip hiện là "Đang sửa": <span>Đang sửa</span>
    await expect(page.locator('span').filter({ hasText: 'Đang sửa' })).toBeVisible({ timeout: 5000 });

    // =========================================================================
    // 7. "Hoàn thành" → verify "Đã hoàn thành"
    // =========================================================================
    await page.click('button:has-text("Hoàn thành")');
    await page.waitForResponse(`**/api/rpc`);
    await expect(page.locator('span').filter({ hasText: 'Đã hoàn thành' })).toBeVisible({ timeout: 5000 });

    // =========================================================================
    // 8. Tab "Vật tư" → "Thêm vật tư"
    // =========================================================================
    await page.click('text=Vật tư');

    // Dropdown vật tư: <select value={vtId} onChange={(e) => setVtId(e.target.value)}>
    // Seed có: VT-000001 (Bộ lọc dầu), VT-000002 (Buggi phanh)
    await page.selectOption('select', 'VT-000001'); // Bộ lọc dầu

    await page.fill('input[placeholder="Số lượng"]', '2');

    await Promise.all([
      page.click('button:has-text("Thêm vật tư")'),
      page.waitForResponse(`**/api/rpc`),
    ]);

    // =========================================================================
    // 9. /bao-gia — "Tạo báo giá" cho SC đó
    // =========================================================================
    await page.click('text=Báo giá');
    await expect(page).toHaveURL(`${BASE_URL}/bao-gia`);

    // Bao-gia là wizard multi-step. Ta sẽ fill các field trực tiếp.
    // Bước 1: Chọn SC từ dropdown
    await page.selectOption('select', actualScId);

    // Bước 2: Tên NCC
    await page.fill('input[placeholder="Nhập tên NCC"]', 'Công ty A XYZ');

    // Bước 3: Ngày (đã tự động set là hôm nay bởi app)
    // Bước 4: Mô tả hàng
    await page.fill('input[placeholder="Nhập mô tả hàng"]', 'Bộ lọc dầu');

    // Bước 5: Số lượng
    await page.fill('input[min="0"][step="0.01"]', '2');

    // Bước 6: Đơn giá
    await page.fill('input[min="0"][step="100"]', '120000');

    // Bước 7: Lưu - nhấn nút Lưu báo giá ở cuối wizard
    await Promise.all([
      page.click('button:has-text("Lưu báo giá")'),
      page.waitForResponse(`**/api/rpc`),
    ]);

    // =========================================================================
    // 10. /ho-so — "Tạo hồ sơ" cho SC đó
    // =========================================================================
    await page.click('text=Hồ sơ');
    await expect(page).toHaveURL(`${BASE_URL}/ho-so`);

    // Chọn SC từ dropdown
    await page.selectOption('select', actualScId);

    // Fill số chứng từ và ngày
    await page.fill('input[type="text"]', `CT-${Date.now()}`); // số chứng từ
    await page.fill('input[type="date"]', today);

    await Promise.all([
      page.click('button:has-text("Lưu")'),
      page.waitForResponse(`**/api/rpc`),
    ]);

    // =========================================================================
    // 11. Logout → verify về /login
    // =========================================================================
    await page.click('text=Logout');
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});