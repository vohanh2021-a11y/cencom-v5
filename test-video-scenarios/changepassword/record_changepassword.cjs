// record_changepassword.cjs — quay kich ban Thay doi mat khau thanh webm CO PHU DE
// DEPEND: npm i playwright; dung caption_helper.cjs tai test-video-scenario/scripts
const { chromium } = require('playwright');
const path = require('path');
const { CAP_INIT } = require('E:/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/test-video-scenario/scripts/caption_helper.cjs');

const BASE = 'E:/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/test-video-scenarios/changepassword';
const videoDir = path.join(BASE, 'videos');
const htmlPath = path.join(BASE, 'index.html');
const W = 480, H = 720;

// Thoi luong (giay) lay tu do dai thuc te cua tung file mp3 de video khop giong doc
const DUR = { intro: 5.76, step1: 2.50, step2: 3.53, step3: 3.36, hoan: 6.14 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: videoDir, size: { width: W, height: H } }
  });
  const page = await ctx.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.evaluate(CAP_INIT); // khoi tao caption bar + intro card (body da ton tai)

  // --- Intro ---
  await page.evaluate(() => window.showIntro({
    title: 'Thay đổi mật khẩu',
    desc: 'Chào bạn, video này hướng dẫn thay đổi mật khẩu trong hệ thống CencomOS'
  }));
  await page.evaluate(() => window.setCap('Hướng dẫn thay đổi mật khẩu'));
  await page.waitForTimeout(DUR.intro * 1000);
  await page.evaluate(() => window.hideIntro());

  // --- Step 1: mat khau hien tai ---
  await page.evaluate(() => window.setCap('Bước 1: Nhập mật khẩu hiện tại'));
  await page.fill('#old-pass', 'Cencom@2026!');
  await page.waitForTimeout(DUR.step1 * 1000);

  // --- Step 2: mat khau moi ---
  await page.evaluate(() => window.setCap('Bước 2: Nhập mật khẩu mới (ít nhất 6 ký tự)'));
  await page.fill('#new-pass', 'Cencom@2027!');
  await page.waitForTimeout(DUR.step2 * 1000);

  // --- Step 3: xac nhan mat khau moi ---
  await page.evaluate(() => window.setCap('Bước 3: Nhập lại mật khẩu mới để xác nhận'));
  await page.fill('#confirm-pass', 'Cencom@2027!');
  await page.waitForTimeout(DUR.step3 * 1000);

  // --- Submit -> success ---
  await Promise.all([
    page.click('button.btn'),
    page.waitForSelector('#success', { state: 'visible', timeout: 10000 })
  ]);

  // --- Hoan tat ---
  await page.evaluate(() => window.setCap('Hoàn tất: mật khẩu đã được cập nhật thành công'));
  await page.waitForTimeout(DUR.hoan * 1000);

  await page.evaluate(() => window.setCap(''));
  await page.waitForTimeout(800); // du dy duoi audio

  await ctx.close();
  await browser.close();
  console.log('Video recorded in', videoDir);
})().catch(e => { console.error(e); process.exit(1); });
