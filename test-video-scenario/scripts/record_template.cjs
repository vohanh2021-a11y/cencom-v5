// record_template.cjs — quay 1 kich ban thanh webm CO PHU DE (CHINH SUA CHO TUNG KICH BAN)
// DEPEND: npm i playwright, file caption_helper.cjs cung thu muc.
const { chromium } = require('playwright');
const { CAP_INIT } = require('./caption_helper.cjs');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.OUT_DIR || 'videos/scenario_X';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ recordVideo: { dir: OUT, size: '1366x768' } });
  const page = await ctx.newPage();
  await page.addInitScript({ content: CAP_INIT });

  // --- 1. Intro (the hien o dau video) ---
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.showIntro({
    title: 'Kịch bản 1 — Thợ nhận xe',
    desc: 'Mục tiêu: thợ tạo phiếu tiếp nhận xe mới.'
  }));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.hideIntro());

  // --- 2. Cac buoc (THAY selector that te cua tung kich ban) ---
  await page.evaluate(() => window.setCap('Bước 1: Đăng nhập bằng tài khoản thợ'));
  await page.fill('#user', 'tho01');
  await page.fill('#pass', 'Cencom@2026!');
  await page.click('button:has-text("Đăng nhập")', { force: true }); // force vi bottom-nav de len
  await page.waitForTimeout(800);

  await page.evaluate(() => window.setCap('Bước 2: Mở form tiếp nhận và nhập thông tin xe'));
  // ... click/diem day selector that te ...
  await page.waitForTimeout(600);

  await page.evaluate(() => window.setCap('')); // tat phu de cuoi
  await page.waitForTimeout(500);

  await ctx.close();
  await browser.close();
  console.log('Video saved in', OUT);
})().catch(e => { console.error(e); process.exit(1); });
