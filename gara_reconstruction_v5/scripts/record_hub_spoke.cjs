// record_hub_spoke.cjs — Hub-and-Spoke + AI bàn giao (5.4.0)
const { chromium } = require('playwright');
const { CAP_CSS } = require('./caption_helper.cjs');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = 'videos/hub-spoke';
fs.mkdirSync(OUT, { recursive: true });

async function injectCap(page) {
  await page.evaluate((css) => {
    if (document.getElementById('cap-bar')) return;
    var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
    var bar=document.createElement('div'); bar.id='cap-bar'; bar.style.display='none'; document.body.appendChild(bar);
    var card=document.createElement('div'); card.id='intro-card';
    card.innerHTML='<div class="box"><h2></h2><p></p></div>'; document.body.appendChild(card);
    window.setCap=function(t){ var b=document.getElementById('cap-bar'); if(t){b.textContent=t; b.style.display='block';} else {b.style.display='none';} };
    window.showIntro=function(o){ var c=document.getElementById('intro-card'); c.querySelector('h2').textContent=(o&&o.title)||''; c.querySelector('p').textContent=(o&&o.desc)||''; c.style.display='flex'; };
    window.hideIntro=function(){ document.getElementById('intro-card').style.display='none'; };
  }, CAP_CSS);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ recordVideo: { dir: OUT, size: { width: 1366, height: 768 } } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await injectCap(page);
  await page.evaluate(() => window.showIntro({ title: 'CencomOS Gara 5.4.0 — Hub-and-Spoke + AI', desc: 'HUB all-in-one + Spoke thin offline + AI chat & vision, MCP LAN' }));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.hideIntro());

  await page.evaluate(() => window.setCap('Bước 1: Đăng nhập HUB với tài khoản admin'));
  await page.fill('input[placeholder="Tài khoản"]', 'admin');
  await page.fill('input[placeholder="Mật khẩu"]', 'cencom@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await page.evaluate(() => window.setCap('Bước 2: Dashboard — KPI xe, SC, tồn kho'));
  await page.waitForTimeout(2500);

  await page.evaluate(() => window.setCap('Bước 3: AI Trợ lý — Hỏi tồn kho thiếu gì'));
  const aiBtn = page.locator('button:has-text("🤖")');
  if (await aiBtn.count() > 0) {
    await aiBtn.click({ force: true });
    await page.waitForTimeout(1000);
    const input = page.locator('input[placeholder="Hỏi AI..."]');
    if (await input.count() > 0) {
      await input.fill('Tồn kho thiếu gì?');
      await page.click('button:has-text("Gửi")');
      await page.waitForTimeout(3000);
    }
  } else {
    await page.waitForTimeout(2000);
  }

  await page.goto(BASE + '/baogia', { waitUntil: 'networkidle' }).catch(()=>{});
  await injectCap(page);
  await page.evaluate(() => window.setCap('Bước 4: Báo giá — Vision upload hóa đơn viết tay'));
  await page.waitForTimeout(2500);

  await page.goto(BASE + '/settings/ai', { waitUntil: 'networkidle' }).catch(()=>{});
  await injectCap(page);
  await page.evaluate(() => window.setCap('Bước 5: Cài đặt AI — Provider/model/baseURL'));
  await page.waitForTimeout(2500);

  await page.evaluate(() => window.setCap('Hoàn tất — Hub 113MB + Spoke 76MB, MCP 81 tools, sync offline, sẵn sàng LAN'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.setCap(''));

  await ctx.close();
  await browser.close();
  console.log('Video saved in', OUT);
})().catch(e => { console.error(e); process.exit(1); });
