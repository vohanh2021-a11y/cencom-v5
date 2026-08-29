import { chromium } from 'playwright';

const BASE = 'http://localhost:3003';
const TMP = 'C:\\Users\\Admin\\AppData\\Local\\Temp\\opencode';
const results = [];
const pass = (n, c, extra = '') => { results.push([c ? 'PASS' : 'FAIL', n, extra]); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' :: ' + extra : '')); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const rpc = async (fn, args) => { const r = await page.request.post(BASE + '/api/rpc', { data: { fn, args } }); return { status: r.status(), json: await r.json().catch(() => ({})) }; };
const readSteps = () => page.evaluate(() => Array.from(document.querySelectorAll('ol li')).map((li) => { const t = (li.textContent || '').replace(/\s+/g, ' ').trim(); return { t, ok: t.includes('✓') }; }));

await page.request.post(BASE + '/api/auth', { data: { action: 'login', user: 'admin', pass: 'cencom@123' } });
const xe = await rpc('xeList', {});
const xeId = xe.json.result[0].id;

// Tạo SC MỚI sạch (không dữ liệu hồ sơ) để test trạng thái thiếu -> Đạt
const c = await rpc('scCreate', { xe_id: xeId, ngay: '2026-08-21' });
const FSC = c.json.result.id;
console.log('FRESH SC =', FSC);

const openSc = async (id) => {
  await page.goto(BASE + '/sc', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table', { timeout: 30000 });
  await page.locator('tr', { hasText: id }).locator('button', { hasText: 'Chi tiết' }).first().click();
  await page.waitForSelector('text=Hồ sơ 8 bước sửa chữa', { timeout: 30000 });
  await page.waitForSelector('ol li', { timeout: 10000 });
};

// ===== S1: panel hiển thị + đủ 8 bước =====
await openSc(FSC);
let steps = await readSteps();
pass('S1 panel 8 bước hiển thị', steps.length === 8, 'count=' + steps.length);

// ===== S2: SC mới -> 7 bước bắt buộc thiếu (✕), bước 6 (không bắt buộc) auto Đạt =====
const missCount = steps.filter((s) => s.ok === false).length;
const s6auto = steps[5].ok === true;
const allMiss = missCount === 7 && s6auto;
pass('S2 SC mới: 7 bước thiếu (✕) + bước 6 không-bắt-buộc auto Đạt', allMiss, `miss=${missCount} s6=${s6auto}`);
await page.screenshot({ path: TMP + '\\ui_s2_thieu.png', fullPage: true });

// ===== S3: Lưu kế hoạch (step1) -> Đạt =====
await page.locator('#kh-form textarea').fill('Kế hoạch: thay má phanh, lọc gió');
await page.locator('#kh-form button', { hasText: 'Lưu kế hoạch' }).click();
await page.waitForTimeout(700);
steps = await readSteps();
pass('S3 Lưu kế hoạch -> step1 Đạt', steps[0].ok === true);

// ===== S4: Lưu kiểm tu (step2) -> Đạt =====
await page.locator('#kt-form textarea').fill('Kiểm tu: má phanh mòn 70%, cần thay');
await page.locator('#kt-form button', { hasText: 'Lưu kiểm tu' }).click();
await page.waitForTimeout(700);
steps = await readSteps();
pass('S4 Lưu kiểm tu -> step2 Đạt', steps[1].ok === true);

// ===== S5: Lưu nghiệm thu (step7) -> Đạt =====
await page.locator('#nn-form input[type=date]').fill('2026-08-21');
await page.locator('#nn-form input[type=number]').nth(0).fill('1500000');
await page.locator('#nn-form input[type=number]').nth(1).fill('500000');
await page.locator('#nn-form button', { hasText: 'Lưu nghiệm thu' }).click();
await page.waitForTimeout(700);
steps = await readSteps();
pass('S5 Lưu nghiệm thu -> step7 Đạt', steps[6].ok === true);
await page.screenshot({ path: TMP + '\\ui_s5_dat.png', fullPage: true });

// ===== S6: Xuất báo cáo (download HTML) =====
try {
  const [dl] = await Promise.all([ page.waitForEvent('download', { timeout: 8000 }), page.locator('button', { hasText: 'Xuất báo cáo' }).click() ]);
  const fn = dl.suggestedFilename();
  await dl.saveAs(TMP + '\\' + fn);
  pass('S6 Xuất báo cáo HTML', fn.endsWith('.html'), fn);
} catch (e) { pass('S6 Xuất báo cáo HTML', false, e.message); }

// ===== S7: Lưu hồ sơ (persist ho_so) =====
try {
  await page.locator('button', { hasText: 'Lưu hồ sơ' }).click();
  await page.waitForTimeout(500);
  const chk = await rpc('hoSoCheck', { sc_id: FSC });
  pass('S7 Lưu hồ sơ (ho_so tồn tại)', chk.json.result !== undefined, 'hasResult=' + (chk.json.result !== undefined));
} catch (e) { pass('S7 Lưu hồ sơ', false, e.message); }

// ===== S8: Deep-link step3 -> /baogia =====
try {
  const [pop] = await Promise.all([ page.waitForEvent('popup', { timeout: 8000 }), page.locator('ol li', { hasText: 'Báo giá NCC' }).locator('button', { hasText: 'Đi tới' }).click() ]);
  const u = pop.url(); await pop.close();
  pass('S8 Deep-link step3 -> /baogia', u.includes('/baogia'), u);
} catch (e) { pass('S8 Deep-link step3 -> /baogia', false, e.message); }

// ===== S9: Deep-link step4 -> /kho/nhap ; step5 -> /kho/xuat =====
let s9 = [];
try { const [p4] = await Promise.all([ page.waitForEvent('popup', { timeout: 8000 }), page.locator('ol li', { hasText: 'Phiếu nhập kho' }).locator('button', { hasText: 'Đi tới' }).click() ]); s9.push(p4.url()); await p4.close(); } catch (e) { s9.push('ERR:' + e.message); }
try { const [p5] = await Promise.all([ page.waitForEvent('popup', { timeout: 8000 }), page.locator('ol li', { hasText: 'Phiếu xuất kho' }).locator('button', { hasText: 'Đi tới' }).click() ]); s9.push(p5.url()); await p5.close(); } catch (e) { s9.push('ERR:' + e.message); }
pass('S9 Deep-link step4/5 -> /kho/nhap + /kho/xuat', s9[0].includes('/kho/nhap') && s9[1].includes('/kho/xuat'), s9.join(' | '));

// ===== S10: Quyết toán bị disable + tooltip khi thiếu hồ sơ (SC da_hoan) =====
const c2 = await rpc('scCreate', { xe_id: xeId, ngay: '2026-08-21' });
const FSC2 = c2.json.result.id;
await rpc('scBatDauSua', { sc_id: FSC2 });
await rpc('scHoanThanh', { sc_id: FSC2 });
await openSc(FSC2);
const qtBtn = page.locator('button', { hasText: 'Quyết toán' });
const disabled = await qtBtn.isDisabled();
const title = await qtBtn.getAttribute('title');
pass('S10 Quyết toán disable + tooltip thiếu hồ sơ', disabled === true && /thiếu hồ sơ/i.test(title || ''), 'disabled=' + disabled + ' title=' + (title || '').slice(0, 40));
await page.screenshot({ path: TMP + '\\ui_s10_quyettoan.png', fullPage: true });

await browser.close();
const pf = results.filter((r) => r[0] === 'PASS').length;
console.log(`\n=== SUMMARY ${pf}/${results.length} PASS ===`);
