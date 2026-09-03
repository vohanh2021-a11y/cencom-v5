const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIDEO_DIR = 'E:\\APP-LAPTOP-SYNC\\cencomOS_gara_4.0_supa\\test-video-scenarios\\changepassword\\videos';
const HTML_FILE = 'E:\\APP-LAPTOP-SYNC\\cencomOS_gara_4.0_supa\\test-video-scenarios\\changepassword\\index.html';

// Ensure video dir exists
if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

// Caption helper CSS and init (from caption_helper.cjs)
const CAP_CSS = `
#cap-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;
  background:rgba(15,23,42,.82);color:#fff;font:600 16px/1.5 system-ui,'Segoe UI',sans-serif;
  padding:10px 16px;text-align:center;pointer-events:none;letter-spacing:.2px;
  text-shadow:0 1px 2px rgba(0,0,0,.6)}
#intro-card{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;
  background:rgba(2,6,23,.72)}
#intro-card .box{max-width:560px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;
  border-radius:14px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:center}
#intro-card h2{margin:0 0 10px;font-size:22px;color:#38bdf8}
#intro-card p{margin:0;font-size:15px;line-height:1.6;color:#cbd5e1}
`;
// Init script: inject CSS and create DOM elements + global functions
const CAP_INIT = `
 (function(){
   var s=document.createElement('style'); s.textContent=\`${CAP_CSS.replace(/`/g, '\\$&')}\`; document.head.appendChild(s);
   var bar=document.createElement('div'); bar.id='cap-bar'; bar.style.display='none'; document.body.appendChild(bar);
   var card=document.createElement('div'); card.id='intro-card';
   card.innerHTML='<div class=\"box\"><h2></h2><p></p></div>'; document.body.appendChild(card);
   window.setCap=function(t){ if(t){bar.textContent=t; bar.style.display='block';} else {bar.style.display='none';} };
   window.showIntro=function(o){ card.querySelector('h2').textContent=(o&&o.title)||''; card.querySelector('p').textContent=(o&&o.desc)||''; card.style.display='flex'; };
   window.hideIntro=function(){ card.style.display='none'; };
 })();
`;

const HTML_PATH = HTML_FILE.replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: VIDEO_DIR,
    },
  });
  const page = await context.newPage();

  // Inject caption CSS
  await page.addStyleTag({ content: CAP_CSS });

  // Inject init script
  await page.addScriptTag({ content: CAP_INIT });

  // Navigate to the changepassword page
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });

  // Show intro caption
  await page.evaluate(() => {
    window.showIntro({ title: 'Thay đổi mật khẩu', desc: 'Chào bạn, video này hướng dẫn thay đổi mật khẩu trong hệ thống CencomOS' });
    window.setCap('Chào bạn, video này hướng dẫn thay đổi mật khẩu trong hệ thống CencomOS');
  });

  // Wait to capture the page and caption
  await page.waitForTimeout(5000);

  // Stop recording and close context
  await context.close();
  await browser.close();

  console.log('Video recorded successfully.');
})();