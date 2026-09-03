// record_demo.cjs — Quay video demo login vo phu de huong dan nguoi moi su dung
const { chromium } = require('playwright');
const { CAP_INIT } = require('./scripts/caption_helper.cjs');
const path = require('path');
const fs = require('fs');

const BASE = 'file:///' + path.resolve(__dirname, 'demo-login.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'videos', 'scenario_1');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  console.log('🎬 Bat dau quay video huong dan nguoi moi su dung...');
  console.log('📍 URL:', BASE);
  console.log('📁 Output:', OUT);
  
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ 
    recordVideo: { dir: OUT, size: { width: 1366, height: 768 } },
    viewport: { width: 1366, height: 768 }
  });
  const page = await ctx.newPage();
  await page.addInitScript({ content: CAP_INIT });

  // --- 1. Intro huong dan ---
  console.log('📝 Phien ban: Hien thi intro huong dan...');
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  
  // Kiem tra showIntro
  const hasShowIntro = await page.evaluate(() => typeof window.showIntro === 'function');
  if (hasShowIntro) {
    await page.evaluate(() => window.showIntro({
      title: 'Huong dan dang nhap he thong CencomOS',
      desc: 'Video nay se dinh ban cac buoc dang nhap vao he thong CencomOS de ban tan rieu giao dien.'
    }));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.hideIntro());
  }

  // --- 2. Buoc 1: Tai khoan ---
  console.log('🔢 Buoc 1: Nhap tai khoan...');
  await page.evaluate(() => window.setCap && window.setCap('Buoc 1: Nhap tai khoan vao o dien tai khoan. Tai khoan mac dinh la: admin'));
  await page.waitForTimeout(500);
  await page.fill('#user', 'admin');
  await page.waitForTimeout(800);

  // --- 3. Buoc 2: Mat khau ---
  console.log('🔢 Buoc 2: Nhap mat khau...');
  await page.evaluate(() => window.setCap && window.setCap('Buoc 2: Nhap mat khau vao o dien mat khau. Mat khau mac dinh la: admin123'));
  await page.waitForTimeout(500);
  await page.fill('#pass', 'admin123');
  await page.waitForTimeout(800);

  // --- 4. Buoc 3: Click dang nhap ---
  console.log('🔢 Buoc 3: Click nut dang nhap...');
  await page.evaluate(() => window.setCap && window.setCap('Buoc 3: Bam nut Dang nhap de truy cap he thong'));
  await page.waitForTimeout(500);
  await page.click('#login-btn', { force: true });
  await page.waitForTimeout(1500);

  // --- 5. Ket qua ---
  console.log('🔢 Buoc 4: Xac nhan thanh cong...');
  await page.evaluate(() => window.setCap && window.setCap('Thanh cong! He thong da nhan dang tai khoan cua ban.'));
  await page.waitForTimeout(2000);

  // --- 6. Tat phu de ---
  await page.evaluate(() => window.setCap && window.setCap(''));
  await page.waitForTimeout(500);

  // --- 7. Luu video ---
  console.log('💾 Dang luu video huong dan...');
  await ctx.close();
  await browser.close();
  
  console.log('✅ Hoan tat! Video huong dan da luu tai:', OUT);
})().catch(e => { 
  console.error('❌ Loi:', e.message); 
  process.exit(1); 
});