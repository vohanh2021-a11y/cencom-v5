import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
await p.waitForSelector('input[placeholder="Nhập tài khoản"]');
await p.getByPlaceholder('Nhập tài khoản').fill('admin-1');
await p.getByPlaceholder('Nhập mật khẩu').fill('cencom@123');
await p.getByRole('button', { name: 'Đăng nhập' }).click();
await p.waitForURL('**/home');
await p.waitForTimeout(800);

// --- Dark mode ---
const before = await p.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor }));
const toggle = p.getByRole('button', { name: /giao diện/i });
await toggle.click();
await p.waitForTimeout(700);
const after = await p.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor }));
console.log(`🌗 Dark: before cls="${before.cls}" bg=${before.bg}`);
console.log(`🌗 Dark: after  cls="${after.cls}" bg=${after.bg}  => ${after.cls.includes('dark') && after.bg !== before.bg ? '✅ WORKS' : '❌ BROKEN'}`);

// --- Mobile sidebar ---
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + '/home', { waitUntil: 'load' });
await p.waitForTimeout(900);
const m = await p.evaluate(() => {
  const aside = document.querySelector('aside');
  const r = aside ? aside.getBoundingClientRect() : null;
  const menuBtn = document.querySelector('button[aria-label="Mở menu"]');
  return {
    asideRect: r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) } : null,
    offCanvas: r ? (r.right <= 1 || r.left >= window.innerWidth) : null,
    hasMenuBtn: !!menuBtn,
  };
});
console.log(`📱 Mobile: asideRect=${JSON.stringify(m.asideRect)} offCanvas=${m.offCanvas} hasMenuBtn=${m.hasMenuBtn}`);
// Open drawer
if (m.hasMenuBtn) {
  await p.getByRole('button', { name: 'Mở menu' }).click();
  await p.waitForTimeout(500);
  const m2 = await p.evaluate(() => { const a = document.querySelector('aside'); const r = a.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right) }; });
  console.log(`📱 After menu click: asideRect=${JSON.stringify(m2)} => ${m2.right > 1 ? '✅ DRAWER OPENS' : '❌ STUCK'}`);
}
await b.close();
