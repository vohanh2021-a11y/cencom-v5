// record_profile.cjs — quay kich ban "Profile Configuration" thanh webm CO PHU DE
const { chromium } = require('playwright');
const { CAP_INIT } = require('../../test-video-scenario/scripts/caption_helper.cjs');
const fs = require('fs');
const path = require('path');

// Duong dan tuyet doi den file index.html cua kich ban
const INDEX = 'file://' + path.resolve(__dirname, 'index.html');
const VIDEOS = path.resolve(__dirname, 'videos');
fs.mkdirSync(VIDEOS, { recursive: true });

const INTRO_TITLE = 'Cấu hình hồ sơ — CencomOS';
const INTRO_DESC = 'Kịch bản: tạo / cập nhật hồ sơ người dùng';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ recordVideo: { dir: VIDEOS, size: { width: 1366, height: 768 } } });
  const page = await ctx.newPage();

  // --- 1. Intro ---
  await page.goto(INDEX, { waitUntil: 'load' });
  await page.evaluate(CAP_INIT); // inject caption helper sau khi DOM san sang
  await page.evaluate((t) => window.showIntro({ title: t.title, desc: t.desc }),
    { title: INTRO_TITLE, desc: INTRO_DESC });
  await page.evaluate(() => window.setCap('Chào bạn, video này hướng dẫn cấu hình hồ sơ người dùng trong hệ thống CencomOS'));
  await page.waitForTimeout(6290);
  await page.evaluate(() => window.hideIntro());

  // --- 2. Buoc 1: Ho va ten ---
  await page.evaluate(() => window.setCap('Bước 1: Nhập họ và tên đầy đủ'));
  await page.fill('#full-name', 'Nguyen Van A');
  await page.waitForTimeout(2500);

  // --- 3. Buoc 2: Phong ban ---
  await page.evaluate(() => window.setCap('Bước 2: Nhập tên phòng ban'));
  await page.fill('#department', 'Phong Ky Thuat');
  await page.waitForTimeout(2090);

  // --- 4. Buoc 3: Chuc vu + Luu ---
  await page.evaluate(() => window.setCap('Bước 3: Nhập chức vụ và nhấn Lưu cấu trúc'));
  await page.fill('#position', 'Ky Thuat Vien');
  await page.waitForTimeout(800);
  await page.click('button.btn');
  await page.waitForTimeout(2490);

  // --- 5. Hoan tat ---
  await page.evaluate(() => window.setCap('Hoàn tất, thông tin cấu trúc đã được cập nhật thành công vào hệ thống CencomOS'));
  await page.waitForTimeout(6620);

  await page.evaluate(() => window.setCap('')); // tat phu de
  await page.waitForTimeout(400);

  const vpath = await page.video().path();
  await ctx.close();
  await browser.close();

  const finalPath = path.join(VIDEOS, 'profile.webm');
  if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
  fs.renameSync(vpath, finalPath);
  console.log('VIDEO', finalPath);
})().catch(e => { console.error(e); process.exit(1); });
