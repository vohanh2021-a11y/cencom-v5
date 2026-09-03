/**
 * record-ux.mjs — Quay video UX xuyên suốt CencomOS v4.0 bằng Playwright recordVideo.
 *
 * Yêu cầu: DATABASE_URL có dữ liệu demo, app dev server đang chạy (port 3001).
 * - Import playwright từ huashu-design node_modules nếu project thiếu.
 * - Chạy seed-demo-data trước khi quay.
 * - Launch chromium HEADFUL, recordVideo, slowMo 120.
 * - Flow: /login (admin-1 / cencom@123) → dashboard → SC (xem danh sách) → Kho → Báo giá → Hồ sơ → logout.
 * - Mỗi bước in console.log + waitForTimeout.
 * - BẮT BUỘC: context.close() để lưu video.
 *
 * Chạy: node scripts/record-ux.mjs
 * Output: videos/<timestamp>.webm
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// --- Import playwright: Ưu tiên huashu-design, fallback project node_modules ---
let playwright;
try {
  // Thử import từ huashu-design skill path
  playwright = require('playwright');
} catch (e) {
  console.warn('⚠️ Không import được playwright từ mặc định, thử đường dẫn huashu-design...');
  // Absolute path huashu-design
  const path = require('path');
  const huashuPlaywright = path.resolve(
    'C:/Users/Admin/.config/opencode/skills/huashu-design/node_modules/playwright'
  );
  try {
    // Đúng inject path vào module resolution tạm thời
    delete require.cache[require.resolve('path')];
    const mp = require('module');
    const originalRequire = require;
    require = function(id, parent) {
      if (id === 'playwright') {
        return originalRequire(huashuPlaywright, parent);
      }
      return originalRequire.apply(this, arguments);
    };
    playwright = require('playwright');
  } catch (e2) {
    console.error('❌ Không thể tải playwright:', e2.message);
    process.exit(1);
  }
}

import { mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

// Cấu hình
const BASE = process.env['APP_URL'] || 'http://localhost:3001';
const VIDEOS = path.resolve('videos');
mkdirSync(VIDEOS, { recursive: true });

console.log('🔧 Bước 1: Chạy seed-demo-data...');
try {
  // Chạy script seed qua node
  const seedResult = execSync('node scripts/seed-demo-data.mjs', {
    cwd: 'E:\\APP-LAPTOP-SYNC\\cencomOS_gara_4.0_supa',
    stdio: 'inherit',
    timeout: 60000,
  });
  console.log('  ✅ Seed xong.');
} catch (e) {
  console.error('❌ Seed thất bại, nhưng vẫn tiếp tục record (nếu dữ liệu đã có).', e.message);
}

// --- Import playwright again after possible re-init ---
let p;
try {
  p = require('playwright');
} catch (e) {
  console.error('❌ Vẫn không thể import playwright. Kiểm tra đường dẫn node_modules.');
  process.exit(1);
}

const { chromium } = p;

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 120, args: ['--no-sandbox', '--disable-web-security'] });
  const context = await browser.newContext({
    recordVideo: { dir: VIDEOS, size: { width: 1440, height: 900 } },
    viewport: { width: 1440, height: 900 },
    // Quan trọng: chỉ close context mới lưu video
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const log = (s) => { console.log(`▶ ${s}`); };

  async function step(name, fn) {
    try {
      log(name);
      await fn();
      await page.waitForTimeout(1300);
    } catch (e) {
      console.warn(`⚠️ ${name} lỗi: ${e.message}`);
    }
  }
  async function goto(pth) {
    await page.goto(BASE + pth, { waitUntil: 'load' });
    await page.waitForTimeout(700);
  }

  // ---- Chuẩn bị: kiểm tra DATABASE_URL ----
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.warn('⚠️ CHƯA CÓ DATABASE_URL, seed có thể chưa chạy.');
  }

  // ---- FLOW ----
  console.log('🚀 Bắt đầu quay video UAT...');

  // 1. Đăng nhập admin qua UI form
  await step('1. /login - Đăng nhập admin (admin-1 / cencom@123)', async () => {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[placeholder="Nhập tài khoản"]', { state: 'visible', timeout: 10000 });
    await page.getByPlaceholder('Nhập tài khoản').fill('admin-1');
    await page.getByPlaceholder('Nhập mật khẩu').fill('cencom@123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/((app)/)?(app)?', { timeout: 15000 }); // chờ redirect về (app)/layout
    console.log('   ✅ Đăng nhập thành công, đã redirect về dashboard.');
  });

  // 2. Dashboard
  await step('2. Dashboard - Xem tổng quan KPI/Chart', async () => {
    await goto('/((app)/)?(app)?/dashboard');
    await page.waitForTimeout(1000);
  });

  // 3. SC - Danh sách phiếu sửa chữa
  await step('3. SC - Danh sách phiếu sửa chữa', async () => {
    await goto('/((app)/)?(app)?/sc');
    await page.waitForTimeout(1000);
    // Kiểm tra có dữ liệu không
    const rowCount = await page.locator('table tbody tr').count();
    console.log(`   📋 Số lượng SC trên danh sách: ${rowCount}.`);
  });

  // 4. Kho - Tổng quan
  await step('4. Kho - Tổng quan', async () => {
    await goto('/((app)/)?(app)?/kho');
    await page.waitForTimeout(1000);
  });

  // 5. Báo giá NCC
  await step('5. Báo giá NCC', async () => {
    await goto('/((app)/)?(app)?/baogia');
    await page.waitForTimeout(1000);
  });

  // 6. Hồ sơ
  await step('6. Hồ sơ', async () => {
    await goto('/((app)/)?(app)?/hoso');
    await page.waitForTimeout(1000);
  });

  // 7. Logout
  await step('7. Logout - Đăng xuất', async () => {
    try {
      await page.getByRole('button', { name: 'Đăng xuất' }).click();
      await page.waitForURL('/login', { timeout: 5000 });
      console.log('   ✅ Đã logout về trang login.');
    } catch (e) {
      console.warn(`   ⚠️ Logout lỗi: ${e.message}`);
    }
  });

  // ---- BẮT BUỘC: Close context để lưu video ----
  console.log('💾 Đang đóng context để lưu file video...');
  await context.close();

  // In ra đường dẫn file video đã tạo
  const files = readdirSync(VIDEOS).filter((f) => f.endsWith('.webm')).sort();
  if (files.length > 0) {
    const latest = files[files.length - 1];
    const latestPath = path.join(VIDEOS, latest);
    const sizeMs = statSync(latestPath).size;
    const sizeMB = Math.round(sizeMs / 1e6);
    console.log(`✅ Video đã lưu: ${VIDEOS}/${latest} (${sizeMB} MB)`);
    console.log('   Bạn có thể dùng ffmpeg để chuyển sang MP4:');
    console.log(`   ffmpeg -i "${VIDEOS}/${latest}" -c:v copy -c:a aac videos/uat-tour.mp4`);
  } else {
    console.warn('⚠️ Không tìm thấy file video .webm trong thư mục videos/.');
  }

  await browser.close();
}

main().catch(async (e) => {
  console.error('❌ Lỗi quay video:', e);
  try { await context.close(); } catch {}
  await browser.close();
  process.exit(1);
});