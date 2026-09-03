// record_video.cjs — quay kich ban "Permission Check" thanh webm CO PHU DE
// Chay: node record_video.cjs  (tu thu muc permission\scripts)
// DEPEND: npm i playwright, file caption_helper.cjs cung thu muc.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { CAP_INIT } = require('./caption_helper.cjs');

const BASE = path.resolve(__dirname, '..');
const htmlPath = path.join(BASE, 'index.html');
const OUT = path.join(BASE, 'videos');
fs.mkdirSync(OUT, { recursive: true });

const RAW_NAME = 'permission_raw.webm';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 450, height: 650 },
    recordVideo: { dir: OUT, size: { width: 450, height: 650 } }
  });
  const page = await ctx.newPage();

  // --- 1. Intro ---
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.evaluate(CAP_INIT);
  await page.evaluate(() => window.showIntro({
    title: 'Kiểm tra phân quyền',
    desc: 'Chào bạn, video này hướng dẫn kiểm tra phân quyền truy cập trong hệ thống CencomOS'
  }));
  await page.waitForTimeout(3500);
  await page.evaluate(() => window.hideIntro());

  // --- 2. Cac buoc ---
  await page.evaluate(() => window.setCap('Bước 1: Nhấn nút kiểm tra quyền truy cập'));
  await page.waitForTimeout(2500);
  await Promise.all([
    page.click('#check-btn'),
    page.waitForSelector('#success', { state: 'visible', timeout: 10000 })
  ]);

  await page.evaluate(() => window.setCap('Bước 2: Hiển thị kết quả quyền hợp lệ'));
  await page.waitForTimeout(3000);

  await page.evaluate(() => window.setCap('Bước 3: Kết thúc kiểm tra phân quyền'));
  await page.waitForTimeout(2500);

  await page.evaluate(() => window.setCap('Hoàn tất: hệ thống đã xác thực tài khoản có quyền truy cập đầy đủ'));
  await page.waitForTimeout(3000);

  await page.evaluate(() => window.setCap('')); // tat phu de cuoi
  await page.waitForTimeout(500);

  await ctx.close();
  await browser.close();

  // Đổi tên file webm thu được thành tên cố định
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.webm'));
  if (files.length) {
    files.sort((a, b) =>
      fs.statSync(path.join(OUT, b)).mtimeMs - fs.statSync(path.join(OUT, a)).mtimeMs);
    const latest = path.join(OUT, files[0]);
    const target = path.join(OUT, RAW_NAME);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    fs.renameSync(latest, target);
    console.log('Video saved:', target);
  } else {
    console.error('Không tìm thấy file webm nào được ghi.');
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
