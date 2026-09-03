/**
 * Visual test v3 — robust login + screenshots light/dark + video
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.fill('input[placeholder="Nhập tài khoản"]', 'admin');
  await page.fill('input[placeholder="Nhập mật khẩu"]', 'cencom@123');

  // Click submit and wait for navigation (not just networkidle)
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log(`  📍 After login: ${url}`);

  // If redirected to /change-password (must_change=1), submit new password
  if (url.includes('change-password')) {
    console.log('  → must_change detected, setting new password...');
    const passInputs = page.locator('input[type="password"]');
    const count = await passInputs.count();
    if (count >= 2) {
      await passInputs.nth(0).fill('cencom@123');
      await passInputs.nth(1).fill('Admin@12345');
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
        page.click('button[type="submit"]'),
      ]);
      await page.waitForTimeout(3000);
      console.log(`  📍 After change-password: ${page.url()}`);
    }
  }

  return page;
}

async function screenshot(page, name, filepath) {
  await page.goto(`${BASE}${name}`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  ✅ ${path.basename(filepath)}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ===== LOGIN =====
  console.log('🔐 Đăng nhập admin/cencom@123...');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await login(ctx);

  const finalUrl = page.url();
  const loggedIn = !finalUrl.includes('login');
  console.log(`  ${loggedIn ? '✅' : '❌'} Login ${loggedIn ? 'thành công' : 'thất bại'} — ${finalUrl}`);

  if (!loggedIn) {
    // Try to get error message from page
    const errorText = await page.textContent('p.text-red-600').catch(() => 'không có');
    console.log(`  Error message: ${errorText}`);

    // Check API response directly
    console.log('\n  Thử gọi API trực tiếp...');
    const apiResult = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'cencom@123' }),
        });
        return { status: r.status, body: await r.text() };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log(`  API response: ${JSON.stringify(apiResult)}`);
  }

  if (loggedIn) {
    // ===== LIGHT MODE =====
    console.log('\n☀️ === LIGHT MODE ===');
    await screenshot(page, '/home', path.join(__dirname, '01-home-light.png'));
    await screenshot(page, '/dashboard', path.join(__dirname, '02-dashboard-light.png'));
    await screenshot(page, '/sc', path.join(__dirname, '03-sc-light.png'));
    await screenshot(page, '/kho', path.join(__dirname, '04-kho-light.png'));

    // ===== DARK MODE =====
    console.log('\n🌙 === DARK MODE ===');
    // Navigate to a page with topbar first
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Toggle dark mode
    const toggleBtn = page.locator('button[aria-label*="giao diện"]').first();
    const hasToggle = (await toggleBtn.count()) > 0;
    if (hasToggle) {
      await toggleBtn.click();
      await page.waitForTimeout(1500);
      console.log('  ✅ Toggled dark mode via button');
    } else {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      });
      await page.waitForTimeout(1000);
      console.log('  ✅ Dark mode via JS');
    }

    await screenshot(page, '/dashboard', path.join(__dirname, '05-dashboard-dark.png'));
    await screenshot(page, '/home', path.join(__dirname, '06-home-dark.png'));
    await screenshot(page, '/sc', path.join(__dirname, '07-sc-dark.png'));

    // ===== VIDEO =====
    console.log('\n🎥 Quay video...');
    const videoCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: path.join(__dirname, 'videos'), size: { width: 1440, height: 900 } },
    });
    const vp = await login(videoCtx);

    // Light mode pages
    for (const p of ['/home', '/dashboard', '/sc', '/kho']) {
      await vp.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await vp.waitForTimeout(2500);
      console.log(`  🎬 ${p} (light)`);
    }

    // Toggle dark
    await vp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await vp.waitForTimeout(1500);
    const vToggle = vp.locator('button[aria-label*="giao diện"]').first();
    if ((await vToggle.count()) > 0) {
      await vToggle.click();
    } else {
      await vp.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); });
    }
    await vp.waitForTimeout(1500);

    for (const p of ['/dashboard', '/home', '/sc']) {
      await vp.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 });
      await vp.waitForTimeout(2500);
      console.log(`  🎬 ${p} (dark)`);
    }

    const videoPath = await vp.video()?.path();
    await videoCtx.close();
    if (videoPath) console.log(`\n🎥 Video: ${videoPath}`);
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
