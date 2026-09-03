/**
 * Visual test: Chụp ảnh Light mode + Dark mode + Quay video
 * Chạy: node screenshots/visual-test.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname);
const BASE = 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: undefined,
  });

  // ===== STEP 1: Login =====
  console.log('🔐 Đang đăng nhập...');
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill login form
  const usernameInput = page.locator('input[name="username"], input[type="text"], input[placeholder*="tên"], input[placeholder*="user"]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

  await usernameInput.fill('admin');
  await passwordInput.fill('admin');
  await page.locator('button[type="submit"], button:has-text("Đăng nhập"), button:has-text("Login")').first().click();
  await page.waitForTimeout(3000);

  // Check if logged in
  const url = page.url();
  console.log(`📍 Current URL after login: ${url}`);

  if (url.includes('login')) {
    console.log('⚠️ Login might have failed, trying to navigate...');
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }

  // ===== STEP 2: LIGHT MODE screenshots =====
  console.log('\n📸 Chụp ảnh LIGHT MODE...');

  // Home
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-home-light.png'), fullPage: true });
  console.log('  ✅ 01-home-light.png');

  // Dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-dashboard-light.png'), fullPage: true });
  console.log('  ✅ 02-dashboard-light.png');

  // SC (Phiếu sửa chữa)
  await page.goto(`${BASE}/sc`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-sc-light.png'), fullPage: true });
  console.log('  ✅ 03-sc-light.png');

  // Kho
  await page.goto(`${BASE}/kho`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-kho-light.png'), fullPage: true });
  console.log('  ✅ 04-kho-light.png');

  // ===== STEP 3: Toggle dark mode =====
  console.log('\n🌙 Chuyển sang DARK MODE...');
  // Click the dark mode toggle button (sun/moon icon in topbar)
  const darkToggle = page.locator('button[aria-label*="giao diện"]').first();
  if (await darkToggle.isVisible()) {
    await darkToggle.click();
    await page.waitForTimeout(1500);
    console.log('  ✅ Đã chuyển dark mode');
  } else {
    console.log('  ⚠️ Không tìm thấy nút dark mode, dùng JS fallback');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(1500);
  }

  // ===== STEP 4: DARK MODE screenshots =====
  console.log('\n📸 Chụp ảnh DARK MODE...');

  // Dashboard (dark)
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-dashboard-dark.png'), fullPage: true });
  console.log('  ✅ 05-dashboard-dark.png');

  // Home (dark)
  await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-home-dark.png'), fullPage: true });
  console.log('  ✅ 06-home-dark.png');

  // SC (dark)
  await page.goto(`${BASE}/sc`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-sc-dark.png'), fullPage: true });
  console.log('  ✅ 07-sc-dark.png');

  // ===== STEP 5: Video recording (light mode) =====
  console.log('\n🎥 Quay video LIGHT MODE...');
  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: path.join(SCREENSHOTS_DIR, 'videos'),
      size: { width: 1440, height: 900 },
    },
  });
  const videoPage = await videoContext.newPage();

  // Login for video
  await videoPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await videoPage.waitForTimeout(1000);
  const vUsername = videoPage.locator('input[name="username"], input[type="text"], input[placeholder*="tên"], input[placeholder*="user"]').first();
  const vPassword = videoPage.locator('input[name="password"], input[type="password"]').first();
  if (await vUsername.isVisible()) {
    await vUsername.fill('admin');
    await vPassword.fill('admin');
    await videoPage.locator('button[type="submit"], button:has-text("Đăng nhập"), button:has-text("Login")').first().click();
    await videoPage.waitForTimeout(3000);
  }

  // Walk through pages
  const pages = ['/home', '/dashboard', '/sc', '/kho'];
  for (const p of pages) {
    await videoPage.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
    await videoPage.waitForTimeout(2500);
    console.log(`  🎬 Recording ${p}`);
  }

  // Toggle dark mode in video
  const vDarkToggle = videoPage.locator('button[aria-label*="giao diện"]').first();
  if (await vDarkToggle.isVisible()) {
    await vDarkToggle.click();
    await videoPage.waitForTimeout(1500);
  }

  // Walk through dark pages
  for (const p of ['/dashboard', '/home', '/sc']) {
    await videoPage.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
    await videoPage.waitForTimeout(2500);
    console.log(`  🎬 Recording ${p} (dark)`);
  }

  // Close video context to save video
  const videoPath = await videoPage.video()?.path();
  await videoContext.close();

  // ===== STEP 6: Login page screenshot =====
  console.log('\n📸 Chụp login page...');
  const loginPage = await context.newPage();
  // Clear auth
  await context.clearCookies();
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await loginPage.waitForTimeout(1500);
  await loginPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '00-login.png'), fullPage: true });
  console.log('  ✅ 00-login.png');

  await browser.close();

  console.log('\n✅ HOÀN TẤT!');
  console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);
  if (videoPath) console.log(`🎥 Video: ${videoPath}`);
  console.log('\nDanh sách ảnh:');
  console.log('  00-login.png         - Trang đăng nhập');
  console.log('  01-home-light.png    - Home (sáng)');
  console.log('  02-dashboard-light.png - Dashboard (sáng)');
  console.log('  03-sc-light.png      - Phiếu sửa chữa (sáng)');
  console.log('  04-kho-light.png     - Kho (sáng)');
  console.log('  05-dashboard-dark.png - Dashboard (tối)');
  console.log('  06-home-dark.png     - Home (tối)');
  console.log('  07-sc-dark.png       - Phiếu sửa chữa (tối)');
}

run().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
