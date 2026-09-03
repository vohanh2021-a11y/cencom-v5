import { chromium } from 'playwright';

const BASE = 'http://localhost:3003';
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const rpc = async (fn, args) => {
  const r = await page.request.post(BASE + '/api/rpc', { data: { fn, args } });
  return { status: r.status(), json: await r.json().catch(() => ({})) };
};
const readSteps = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('ol li')).map((li) => {
      const t = (li.textContent || '').replace(/\s+/g, ' ').trim();
      return { t, ok: t.includes('✓'), miss: t.includes('✕') };
    })
  );

const log = (...a) => console.log(...a);

// 1) Login
const res = await page.request.post(BASE + '/api/auth', { data: { action: 'login', user: 'admin', pass: 'cencom@123' } });
log('LOGIN', res.status(), JSON.stringify(await res.json().catch(() => ({}))));

// 2) Mở chi tiết SC-000002
await page.goto(BASE + '/sc', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('table', { timeout: 30000 });
const detailBtn = page.locator('button', { hasText: 'Chi tiết' }).first();
await detailBtn.click();
await page.waitForSelector('text=Hồ sơ 8 bước sửa chữa', { timeout: 30000 });
await page.waitForSelector('ol li', { timeout: 10000 });
let steps = await readSteps();
log('STEPS_COUNT=', steps.length);
log('INITIAL step1 ok=', steps[0].ok, '| step3 ok=', steps[2].ok);
if (steps[0].ok) log('WARN: step1 unexpectedly ok at start');
if (!steps[2].ok) log('WARN: step3 unexpectedly missing (expected Đạt from mirrored bao_gia_ncc)');

// 3) Lưu kế hoạch (step 1)
await page.locator('#kh-form textarea').fill('Kế hoạch thay má phanh trước/sau');
await page.locator('#kh-form button', { hasText: 'Lưu kế hoạch' }).click();
await page.waitForTimeout(800);
steps = await readSteps();
log('AFTER keHoach: step1 ok=', steps[0].ok);
if (!steps[0].ok) { log('FAIL: step1 still missing after save'); }

// 4) Lưu kiểm tu (step 2)
await page.locator('#kt-form textarea').fill('Kiểm tu: má phanh mòn, cần thay');
await page.locator('#kt-form button', { hasText: 'Lưu kiểm tu' }).click();
await page.waitForTimeout(800);
steps = await readSteps();
log('AFTER kiemTu: step2 ok=', steps[1].ok);
if (!steps[1].ok) { log('FAIL: step2 still missing after save'); }

// 5) Deep-link step 3 -> /baogia (popup)
let popupUrl = null;
try {
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 8000 }),
    page.locator('ol li', { hasText: 'Báo giá NCC' }).locator('button', { hasText: 'Đi tới' }).click(),
  ]);
  popupUrl = popup.url();
  log('DEEPLINK step3 popup=', popupUrl);
  await popup.close();
} catch (e) {
  log('DEEPLINK step3 FAIL', e.message);
}

// 6) Export báo cáo
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.locator('button', { hasText: 'Xuất báo cáo' }).click(),
  ]);
  const dl = download.suggestedFilename();
  await download.saveAs('C:\\Users\\Admin\\AppData\\Local\\Temp\\opencode\\' + dl);
  log('EXPORT_OK', dl);
} catch (e) {
  log('EXPORT_FAIL', e.message);
}

// 7) Gate quyết toán: SC mới -> hoàn -> quyết toán phải BỊ CHẶN (thiếu hồ sơ)
const xe = await rpc('xeList', {});
const xeId = xe.json.result && xe.json.result[0] && xe.json.result[0].id;
const c = await rpc('scCreate', { xe_id: xeId, ngay: '2026-08-21' });
const newSc = c.json.result && c.json.result.id;
log('GATE new SC=', newSc);
await rpc('scBatDauSua', { sc_id: newSc });
await rpc('scHoanThanh', { sc_id: newSc });
const qt = await rpc('scQuyetToan', { sc_id: newSc });
log('GATE scQuyetToan ok=', qt.json.ok, '| error=', qt.json.error);
if (qt.json.ok) log('FAIL: quyết toán không bị chặn khi thiếu hồ sơ');
else if (!/thiếu hồ sơ/.test(qt.json.error || '')) log('WARN: bị chặn nhưng sai thông báo:', qt.json.error);

await page.screenshot({ path: 'C:\\Users\\Admin\\AppData\\Local\\Temp\\opencode\\hoso_panel2.png', fullPage: true });
log('CONSOLE_ERRORS=', errors.length);
errors.slice(0, 12).forEach((e) => log('  ' + e));
await browser.close();
log('DONE');
