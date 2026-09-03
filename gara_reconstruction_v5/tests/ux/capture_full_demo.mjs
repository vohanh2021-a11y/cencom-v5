import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3003';
const OUT = path.resolve('tests/ux/screenshots');
fs.mkdirSync(OUT, { recursive: true });
console.log('OUT:', OUT);

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();

// helper
const rpc = async (fn, args) => {
  const r = await page.request.post(BASE + '/api/rpc', { data: { fn, args } });
  return { status: r.status(), json: await r.json().catch(() => ({})) };
};
const shot = async (name, extraWait = 500) => {
  await page.waitForTimeout(extraWait);
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log('SHOT', name);
};

// login admin
console.log('LOGIN admin');
await page.request.post(BASE + '/api/auth', { data: { action: 'login', user: 'admin', pass: 'cencom@123' } });

// need xe for scCreate
const xe = await rpc('xeList', {});
const xeId = xe.json.result?.[0]?.id || 'XE-000001';
console.log('xeId', xeId);
const c = await rpc('scCreate', { xe_id: xeId, ngay: '2026-08-31' });
const FSC = c.json.result?.id || 'SC-000001';
console.log('FSC', FSC);

// add some data to make 8 steps partly done (so buttons visible)
await rpc('keHoachSave', { sc_id: FSC, mo_ta: 'Kế hoạch demo chụp hình' }).catch(()=>{});

// 1) SC list
await page.goto(BASE + '/sc', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('table', { timeout: 15000 }).catch(()=>{});
await shot('01-sc-list.png');

// 2) SC detail - 8 step panel
await page.locator('tr', { hasText: FSC }).locator('button', { hasText: 'Chi tiết' }).first().click().catch(async()=>{
  // fallback goto direct
  await page.goto(BASE + `/sc/${FSC}`, { waitUntil: 'domcontentloaded' }).catch(()=>{});
});
try { await page.waitForSelector('text=Hồ sơ 8 bước', { timeout: 15000 }); } catch {}
try { await page.waitForSelector('ol li', { timeout: 8000 }); } catch {}
await shot('02-sc-detail-8steps.png');

// 3) highlight buttons in panel (if exists)
try {
  const btns = page.locator('button');
  await btns.first().waitFor({ timeout: 5000 }).catch(()=>{});
} catch {}
await shot('03-sc-detail-buttons.png');

// 4) Kho
await page.goto(BASE + '/kho', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Kho', { timeout: 10000 }).catch(()=>{});
await shot('04-kho.png');

// 5) Kho Nhap
await page.goto(BASE + '/kho/nhap', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await shot('05-kho-nhap.png');

// 6) Kho Xuat
await page.goto(BASE + '/kho/xuat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await shot('06-kho-xuat.png');

// 7) Bao gia
await page.goto(BASE + '/baogia', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await shot('07-baogia.png');

// 8) Dashboard
await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await shot('08-dashboard.png');

// 9) Export demo - click export on SC detail if exists
await page.goto(BASE + '/sc', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('table', { timeout: 10000 }).catch(()=>{});
await shot('09-sc-list-with-export.png');

console.log('DONE');
await browser.close();
