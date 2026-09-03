/**
 * UAT/playwright.config.ts — Cấu hình UAT tự động (folder UAT/).
 * Mỗi case sinh video UAT/videos/<TC-ID>.webm (đổi tên bởi rename-videos.mjs).
 */
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env['E2E_BASE_URL'] || 'http://localhost:3000';
// Vai nghiệp vụ trong index.json có thể lệch tên storageState:
// 'khoa' (Kho vật tư) → file .auth/khovattu.json
const ROLE_ALIAS: Record<string, string> = { khoa: 'khovattu' };
const ROLES = ['admin', 'giamdoc', 'xuong', 'khovattu', 'ketoan', 'pttb', 'laixe', 'khoa'];

export default defineConfig({
  testDir: path.resolve(__dirname, 'cases'),
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  // workers=1: tránh race INSERT dữ liệu test khi 7 project chạy cùng lúc
  // (bài học w1/w3 — 2 test INSERT xe cùng bks random trùng ms).
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.resolve(__dirname, 'reports', 'html') }],
  ],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
  },
  webServer: {
    command: 'node _start-dev.mjs',
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
    { name: 'setup', testMatch: /execute\.spec\.ts/, grep: /login/, use: { baseURL: BASE } },
    ...ROLES.map((r) => ({
      name: `uat-${r}`,
      testMatch: /execute\.spec\.ts/,
      grep: /TC-/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE,
        storageState: path.resolve(__dirname, '.auth', `${ROLE_ALIAS[r] || r}.json`),
      },
      dependencies: ['setup'],
    })),
  ],
});
