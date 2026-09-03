/**
 * Visual test v2: Login cencom@123 + Chụp Light/Dark + Quay video
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ===== LOGIN =====
  console.log('🔐 Đăng nhập admin/cencom@123...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.fill('input[placeholder="Nhập tài khoản"]', 'admin');
  await page.fill('input[placeholder="Nhập mật khẩu"]', 'cencom@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  const url = page.url();
  console.log(`📍 Sau login: ${url}`);
  if (url.includes('login')) {
    console.log('⚠️ Login fail — thử lại...');
    await page.fill('input[placeholder="Nhập tài khoản"]', 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', 'cencom@123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log(`📍 Retry: ${page.url()}`);
  }

  const loggedIn = !page.url().includes('login');
  if (!loggedIn) {
    console.log('❌ Không đăng nhập được — chụp ảnh login page và các trang public');
  }

  // ===== LIGHT MODE =====
  console.log('\n☀️ === LIGHT MODE ===');

  if (loggedIn) {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '01-home-light.png'), fullPage: true });
    console.log('  ✅ 01-home-light.png');

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '02-dashboard-light.png'), fullPage: true });
    console.log('  ✅ 02-dashboard-light.png');

    await page.goto(`${BASE}/sc`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '03-sc-light.png'), fullPage: true });
    console.log('  ✅ 03-sc-light.png');

    await page.goto(`${BASE}/kho`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '04-kho-light.png'), fullPage: true });
    console.log('  ✅ 04-kho-light.png');

    // ===== DARK MODE =====
    console.log('\n🌙 === DARK MODE ===');
    // Toggle dark mode via Topbar button
    const toggleBtn = page.locator('button[aria-label*="giao diện"]').first();
    if (await toggleBtn.count() > 0 && await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(1500);
      console.log('  ✅ Đã toggle dark mode');
    } else {
      // Fallback: JS injection
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      });
      await page.waitForTimeout(1000);
      console.log('  ✅ Dark mode via JS fallback');
    }

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '05-dashboard-dark.png'), fullPage: true });
    console.log('  ✅ 05-dashboard-dark.png');

    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '06-home-dark.png'), fullPage: true });
    console.log('  ✅ 06-home-dark.png');

    await page.goto(`${BASE}/sc`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, '07-sc-dark.png'), fullPage: true });
    console.log('  ✅ 07-sc-dark.png');

    // ===== VIDEO =====
    console.log('\n🎥 Quay video...');
    // Switch back to light
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });
    await page.waitForTimeout(1000);

    // Use the same page with video recording — create new context for video
    const videoCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: path.join(__dirname, 'videos'), size: { width: 1440, height: 900 } },
    });
    const vp = await videoCtx.newPage();
    // Login
    await vp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await vp.waitForTimeout(1000);
    await vp.fill('input[placeholder="Nhập tài khoản"]', 'admin');
    await vp.fill('input[placeholder="Nhập mật khẩu"]', 'cencom@123');
    await vp.click('button[type="submit"]');
    await vp.waitForTimeout(4000);

    for (const p of ['/home', '/dashboard', '/sc', '/kho']) {
      await vp.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await vp.waitForTimeout(2500);
      console.log(`  🎬 ${p} (light)`);
    }

    // Toggle dark
    const vToggle = vp.locator('button[aria-label*="giao diện"]').first();
    if (await vToggle.count() > 0 && await vToggle.isVisible()) {
      await vToggle.click();
      await vp.waitForTimeout(1500);
    } else {
      await vp.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); });
      await vp.waitForTimeout(1000);
    }

    for (const p of ['/dashboard', '/home', '/sc']) {
      await vp.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await vp.waitForTimeout(2500);
      console.log(`  🎬 ${p} (dark)`);
    }

    const videoPath = await vp.video()?.path();
    await videoCtx.close();
    if (videoPath) console.log(`\n🎥 Video saved: ${videoPath}`);
  }

  // Login page screenshot
  console.log('\n📸 Login page...');
  const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lp = await loginCtx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await lp.waitForTimeout(1500);
  await lp.screenshot({ path: path.join(__dirname, '00-login.png'), fullPage: true });
  console.log('  ✅ 00-login.png');

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ HOÀN TẤT VISUAL TEST');
  console.log('='.repeat(60));
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.png')).sort();
  console.log('\nDanh sách ảnh:');
  for (const f of files) {
    const stat = fs.statSync(path.join(__dirname, f));
    console.log(`  ${f}  (${(stat.size / 1024).toFixed(0)} KB)`);
  }
  const vids = fs.readdirSync(path.join(__dirname, 'videos')).filter(f => f.endsWith('.webm'));
  if (vids.length) {
    console.log('\nVideo:');
    for (const v of vids) {
      const stat = fs.statSync(path.join(__dirname, 'videos', v));
      console.log(`  videos/${v}  (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
    }
  }
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
