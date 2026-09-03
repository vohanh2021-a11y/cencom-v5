/**
 * tests/uat/playwright.config.ts — Cấu hình UAT từng vai, ghi video riêng.
 *
 * Mỗi vai = 1 project (uat-<role>), dùng storageState từ auth.setup.
 * video: 'on' → mỗi test sinh 1 file video tại tests/uat/videos/<project>/<test>.webm
 *
 * Chạy:  npx playwright test --config tests/uat/playwright.config.ts
 * Yêu cầu:
 *   - Web dev chạy tại E2E_BASE_URL (mặc định http://localhost:3000)
 *   - DB có sẵn user UAT (chạy scripts/ensure-uat-users.mjs)
 *   - Đã cài browser: npx playwright install chromium
 */
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env['E2E_BASE_URL'] || 'http://localhost:3000';
const ROLES = ['admin', 'giamdoc', 'xuong', 'khovattu', 'ketoan', 'pttb', 'laixe'];

export default defineConfig({
  testDir: path.resolve(__dirname, 'roles'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.resolve(__dirname, 'report') }],
  ],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
  },
  webServer: {
    command: 'cd apps/web && npm run dev',
    url: 'http://localhost:3000/login',
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      DATABASE_URL:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: BASE },
    },
    ...ROLES.map((r) => ({
      name: `uat-${r}`,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE,
        storageState: path.resolve(__dirname, '.auth', `${r}.json`),
      },
      dependencies: ['setup'],
    })),
  ],
});
