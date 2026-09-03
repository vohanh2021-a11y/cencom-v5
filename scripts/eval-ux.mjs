/**
 * eval-ux.mjs — Đánh giá UX tự động (không cần xem ảnh).
 * Kiểm tra: console errors, nội dung render (heading/table rows), horizontal overflow,
 * dark mode áp dụng, responsive mobile (không tràn ngang, sidebar collapse).
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERR: ' + e.message));

const report = {};

// Login
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForSelector('input[placeholder="Nhập tài khoản"]');
await page.getByPlaceholder('Nhập tài khoản').fill('admin-1');
await page.getByPlaceholder('Nhập mật khẩu').fill('cencom@123');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.waitForURL('**/home');

const pages = ['/home','/dashboard','/sc','/kho','/kho/nhap','/kho/xuat','/kho/dm','/chat','/asset','/baogia','/de-xuat','/de-xuat/create','/perm','/thanhly'];

for (const p of pages) {
  await page.goto(BASE + p, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const h = document.querySelector('h1,h2')?.textContent?.trim() || '(no h1/h2)';
    const main = document.querySelector('main') || document.body;
    const tables = [...document.querySelectorAll('table')].map(t => t.tBodies[0]?.rows.length || 0);
    const cards = document.querySelectorAll('.kpi-card, .card, [class*="Card"]').length;
    const overflowX = document.documentElement.scrollWidth - window.innerWidth;
    return { heading: h, mainChildren: main.children.length, tables, cards, overflowX };
  });
  report[p] = data;
  console.log(`📄 ${p.padEnd(16)} | heading="${data.heading}" | tables=${JSON.stringify(data.tables)} | cards=${data.cards} | overflowX=${data.overflowX}px`);
}

// Dark mode check
await page.goto(BASE + '/home', { waitUntil: 'load' });
await page.waitForTimeout(800);
const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const toggle = page.getByLabel(/giao diện/i).first();
await toggle.waitFor({ state: 'visible' });
await toggle.click();
await page.waitForTimeout(800);
const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const htmlClass = await page.evaluate(() => document.documentElement.className);
console.log(`\n🌗 Dark mode: lightBg=${lightBg} → darkBg=${darkBg} | <html>.class="${htmlClass}" | changed=${lightBg !== darkBg}`);

// Mobile responsive
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/home', { waitUntil: 'load' });
await page.waitForTimeout(1000);
const mobile = await page.evaluate(() => {
  const overflowX = document.documentElement.scrollWidth - window.innerWidth;
  const aside = document.querySelector('aside, nav');
  const asideVisible = aside ? getComputedStyle(aside).display !== 'none' && aside.getBoundingClientRect().width > 0 : 'no-aside';
  return { overflowX, asideVisible };
});
console.log(`📱 Mobile 390px: overflowX=${mobile.overflowX}px | sidebar/aside visible=${mobile.asideVisible}`);

// Console errors summary
console.log(`\n⚠️ Console errors (${consoleErrors.length}):`);
consoleErrors.slice(0, 15).forEach(e => console.log('   - ' + e.slice(0, 140)));

await browser.close();
