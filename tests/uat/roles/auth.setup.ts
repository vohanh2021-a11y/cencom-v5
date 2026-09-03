/**
 * tests/uat/auth.setup.ts — Đăng nhập từng vai, lưu storageState.
 * Chạy tự động (project 'setup') trước các project uat-<role>.
 * Mật khẩu mặc định seed: cencom@123 (đổi qua E2E_PASS).
 */
import { test as setup } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env['E2E_BASE_URL'] || 'http://localhost:3000';
const PASS = process.env['E2E_PASS'] || 'cencom@123';

const users = [
  { role: 'admin', id: 'admin-1' },
  { role: 'giamdoc', id: 'giamdoc-1' },
  { role: 'xuong', id: 'xuong-1' },
  { role: 'khovattu', id: 'khoa-1' },
  { role: 'ketoan', id: 'ketoan-1' },
  { role: 'pttb', id: 'pttb-1' },
  { role: 'laixe', id: 'laixe-1' },
];

for (const u of users) {
  setup(`login ${u.role}`, async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=text]', u.id);
    await page.fill('input[type=password]', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL('**/home', { timeout: 15000 });
    const dir = path.resolve(__dirname, '..', '.auth');
    await page.context().storageState({ path: path.join(dir, `${u.role}.json`) });
    console.log(`[setup] logged in ${u.role} → .auth/${u.role}.json`);
  });
}
