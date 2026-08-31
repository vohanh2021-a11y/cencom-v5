import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { existsSync, rmSync } from 'fs';

/**
 * W1.7 — E2E trang KHO v5 (tab 2 tầng: Vật tư | Phiếu nhập/xuất | Tồn kho |
 * Thanh lý). Chạy với dev server TEST_BASE_URL (mặc định :3001 — xem
 * playwright.config.ts, không đụng port 3000).
 *
 * Login MỘT lần ở beforeAll (lưu storageState) — middleware.ts chặn
 * 5 POST /api/auth mỗi 5 phút; model login-lặp làm 429 treo test (đã gặp).
 *
 * Dữ liệu seed DB local: nhap_xuat ~50 dòng / 45 nhóm phiếu, 2 vật tư
 * active đủ tồn → test TỰ TẠO 1 vật tư thiếu tồn (role kho → is_test=0,
 * lọt bộ lọc số kho) qua chính modal UI, assert badge đỏ, afterAll
 * soft-delete qua pg (deleted_at=id — cùng cơ chế app, không DELETE cứng).
 *
 * Ghi chú backend: tonKho đã đăng ký RPC nhưng DB thật có thể chưa apply
 * migration W1.3 (vattu.ton_cu_hong) → UI tự fallback; assertions dưới
 * ĐỘC LẬP cả hai mode. thanhLyList chưa vào FN_LIST → test placeholder.
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const MARK = `E2E-W17 ${Date.now()}`;
const AUTH_FILE = '.playwright-auth-kho.json';

async function gotoKho(page: Page) {
  await page.goto(`${BASE}/kho`);
  if (page.url().includes('/login')) {
    // Dự phòng khi storageState hết hạn giữa suite (bình thường: không tới đây)
    await page.getByPlaceholder('Tài khoản').fill('kho');
    await page.getByPlaceholder('Mật khẩu').fill('cencom@123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/kho`);
  }
  await expect(page.getByRole('heading', { name: 'Quản lý kho' })).toBeVisible({ timeout: 45000 });
}

test.describe('Kho W1.7 — tab 2 tầng', () => {
  // Dev-mode page compile (first goto) chậm hơn 30s mặc định của config.
  test.describe.configure({ timeout: 120000 });

  test.beforeAll(async ({ browser }) => {
    if (existsSync(AUTH_FILE)) rmSync(AUTH_FILE);
    // storageState:undefined — vì test.use ở describe áp cả vào browser.newContext();
    // file auth chưa tồn tại tại thời điểm beforeAll.
    const ctx = await browser.newContext({ storageState: undefined });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`);
    await p.getByPlaceholder('Tài khoản').fill('kho');
    await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
    await p.getByRole('button', { name: 'Đăng nhập' }).click();
    await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await ctx.storageState({ path: AUTH_FILE });
    await ctx.close();
  });

  test.use({ storageState: AUTH_FILE });

  test('tab mặc định Phiếu: bảng nhóm + click expand chi tiết + chips lọc + phân trang', async ({ page }) => {
    await gotoKho(page);

    // Tầng-1: tab PHIẾU là mặc định → tbody phiếu hiện hàng đầu tiên
    await expect(page.getByTestId('kho-tab-phieu')).toBeVisible();
    const rows = page.getByTestId('phieu-row');
    await expect(rows.first()).toBeVisible({ timeout: 30000 });
    expect(await rows.count()).toBeGreaterThan(0);

    // Phân trang "Trang i/n · Tổng X" reuse trên tab nhóm
    await expect(page.getByTestId('phieu-info')).toContainText(/Trang \d+\/\d+ · Tổng \d+/);

    // Click group-row → phieuGet fetch lines (sub-table lồng + tổng tiền)
    await rows.first().click();
    await expect(page.getByTestId('phieu-lines')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('phieu-line').first()).toBeVisible();
    await expect(page.getByTestId('phieu-detail-total')).toContainText('₫');
    // Collapse
    await rows.first().click();
    await expect(page.getByTestId('phieu-lines')).toBeHidden();

    // Chips loại: Tất/Nhập/Xuất — đổi filter reload không lỗi
    await page.getByTestId('phieu-chip-xuat').click();
    await expect(page.getByTestId('phieu-tbody')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('phieu-error')).toHaveCount(0);
    const xuatRows = await page.getByTestId('phieu-row').count();
    const emptyMsg = await page.getByText('Chưa có phiếu nào khớp bộ lọc').count();
    expect(xuatRows + emptyMsg).toBeGreaterThan(0); // hoặc có dòng, hoặc rỗng — không crash

    await page.getByTestId('phieu-chip-tat').click();
    await expect(page.getByTestId('phieu-row').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/kho-01-phieu.png', fullPage: true });
  });

  test('Tồn kho: tạo VT thiếu → badge đỏ "Thiếu ton_min" + lọc "Chỉ hiện thiếu"', async ({ page }) => {
    await gotoKho(page);

    // Tạo vật tư qua modal (role kho → is_test=0, vào sổ kho thật):
    // ton khởi điểm 0 < ton_min 10 → dòng THIẾU deterministic.
    await page.getByRole('button', { name: '+ Vật tư' }).first().click();
    const form = page.getByTestId('vattu-form');
    await expect(form).toBeVisible();
    await form.getByLabel('Tên vật tư').fill(MARK);
    await form.getByLabel('Đơn vị').fill('cái');
    await form.getByLabel('Tồn tối thiểu').fill('10');
    await form.getByRole('button', { name: 'Lưu' }).click();
    await expect(form).toBeHidden({ timeout: 20000 });

    // Tab Tồn kho
    await page.getByTestId('kho-tab-tonkho').click();
    const summary = page.getByTestId('tonkho-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Giá trị tồn kho');
    await expect(summary).toContainText('Dưới mức tồn');

    const lowRows = page.getByTestId('tonkho-row').filter({ hasText: MARK });
    await expect(lowRows.first()).toBeVisible({ timeout: 20000 });
    const badge = lowRows.first().getByTestId('tonkho-low-badge');
    await expect(badge).toHaveText('Thiếu ton_min');

    // lowCount >= 1 (dòng vừa tạo)
    const lowCount = Number((await page.getByTestId('tonkho-lowcount').textContent())?.trim());
    expect(lowCount).toBeGreaterThanOrEqual(1);

    // Toggle 'Chỉ hiện thiếu' (server: low_only:true · fallback: lọc client).
    // Poll tới khi DOM ổn định SAU reload: mọi dòng hiển thị đều mang badge
    // thiếu (tránh đếm nhầm danh sách cũ trong lúc bảng đang refresh).
    await page.getByTestId('tonkho-low-only').locator('input[type=checkbox]').check();
    await expect(async () => {
      const c = await page.getByTestId('tonkho-row').count();
      expect(c).toBeGreaterThan(0);
      const badges = await page.getByTestId('tonkho-low-badge').count();
      expect(badges).toBe(c);
      await expect(page.getByTestId('tonkho-row').filter({ hasText: MARK }).first()).toBeVisible();
    }).toPass({ timeout: 15000 });

    // số dòng hiển thị >= 1 và summary có tổng tiền
    const shown = Number((await page.getByTestId('tonkho-rows').textContent())?.trim());
    expect(shown).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: 'test-results/kho-02-tonkho-thieu.png', fullPage: true });
  });

  test('Thanh lý: RPC chưa đăng ký/DB chưa có bảng → placeholder "đang hoàn thiện (W1c.reg)"', async ({ page }) => {
    await gotoKho(page);
    await page.getByTestId('kho-tab-thanhtly').click();
    // ready-empty (bảng có nhưng 0 dòng) CŨNG chấp nhận được khi W1c.reg đã nối:
    const pending = page.getByTestId('thanhtly-pending');
    const empty = page.getByText('Chưa có phiếu thanh lý nào.');
    await expect(pending.or(empty).first()).toBeVisible({ timeout: 15000 });
    if (await pending.count()) {
      await expect(pending).toContainText('đang hoàn thiện (W1c.reg)');
    }
    await page.screenshot({ path: 'test-results/kho-03-thanhly.png', fullPage: true });
  });

  test('Tab Vật tư giữ hành vi cũ: danh mục + chip Đủ/Thiếu tồn', async ({ page }) => {
    await gotoKho(page);
    await page.getByTestId('kho-tab-vattu').click();
    const table = page.locator('table').filter({ hasText: 'Tối thiểu' }).first();
    await expect(table.getByText('Bộ lọc dầu').first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'test-results/kho-04-vattu.png', fullPage: true });
  });
});

// Soft-delete vật tư test đã tạo (đúng cơ chế deleted_at của app —
// không DELETE cứng; dữ liệu test không lẫn vào sổ kho thật sau run).
test.afterAll(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom',
  });
  try {
    const r = await pool.query('UPDATE vattu SET deleted_at = id WHERE ten LIKE $1', ['E2E-W17 %']);
    console.log(`[kho.spec] cleanup soft-deleted rows: ${r.rowCount}`);
  } finally {
    await pool.end();
  }
});
