const { chromium } = require('playwright');
const path = require('path');

const videoDir = path.resolve('E:/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/test-video-scenarios/registration/videos');
const htmlPath = path.resolve('E:/APP-LAPTOP-SYNC/cencomOS_gara_4.0_supa/test-video-scenarios/registration/index.html');

// Caption CSS - injected via addStyleTag
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

// Caption init script - runs in page context, uses window functions
const CAP_INIT_SCRIPT = `
(function(){
  // Create caption bar
  var bar = document.createElement('div');
  bar.id = 'cap-bar';
  bar.style.display = 'none';
  document.body.appendChild(bar);
  
  // Create intro card
  var card = document.createElement('div');
  card.id = 'intro-card';
  card.style.display = 'none';
  card.innerHTML = '<div class="box"><h2></h2><p></p></div>';
  document.body.appendChild(card);
  
  // Define global functions
  window.setCap = function(t) {
    if(t){
      bar.textContent = t;
      bar.style.display = 'block';
    } else {
      bar.style.display = 'none';
    }
  };
  window.showIntro = function(o) {
    card.querySelector('h2').textContent = (o && o.title) || '';
    card.querySelector('p').textContent = (o && o.desc) || '';
    card.style.display = 'flex';
  };
  window.hideIntro = function() {
    card.style.display = 'none';
  };
})();
`;

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 450, height: 650 },
    recordVideo: { dir: videoDir, size: { width: 450, height: 650 } }
  });
  const page = await context.newPage();

  // Load the registration page
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Inject caption CSS
  await page.addStyleTag({ content: CAP_CSS });

  // Initialize caption system in page context
  await page.evaluate(CAP_INIT_SCRIPT);

  // Set intro and captions for each step - fill form and submit
  await page.evaluate(async () => {
    const steps = [
      { title: 'Hồ sơ đăng ký', desc: 'Chào bạn, video này hướng dẫn đăng ký tài khoản mới vào hệ thống CencomOS' },
      { title: 'Bước 1', desc: 'Nhập họ và tên và email' },
      { title: 'Bước 2', desc: 'Nhập mật khẩu ít nhất 6 ký tự' },
      { title: 'Bước 3', desc: 'Nhấn nút đăng ký để tạo tài khoản' },
      { title: 'Hoàn thành', desc: 'Tài khoản đã được tạo thành công vào hệ thống CencomOS' }
    ];

    // Fill form fields
    document.getElementById('reg-user').value = 'Nguyen Van A';
    document.getElementById('reg-email').value = 'test@example.com';
    document.getElementById('reg-pass').value = 'Matkhau1';

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      window.showIntro(steps[i]);
      window.setCap(steps[i].title);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    window.hideIntro();
    window.setCap('');
  });

  // Wait for user interaction - click register button
  await Promise.all([
    page.click('button.btn'),
    page.waitForSelector('#success', { state: 'visible', timeout: 10000 })
  ]);

  // Additional wait to capture the success state
  await new Promise(resolve => setTimeout(resolve, 2000));

  await context.close();
  await browser.close();

  console.log('Video recorded successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});