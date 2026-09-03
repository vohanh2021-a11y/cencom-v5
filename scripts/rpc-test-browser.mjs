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
const fns = ['scList','phNhapList','phXuatList','chatPeers','chatList','vatTuList','tonKho','deXuatList','welcomeData','assetXe','baoGiaList','thanhLyList','dmList','dashboardAll'];
const res = await p.evaluate(async (fns) => {
  const out = [];
  for (const fn of fns) {
    try {
      const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args: [] }) });
      const j = await r.json();
      out.push({ fn, ok: !!j.ok, msg: j.ok ? (Array.isArray(j.result) ? j.result.length + ' rows' : typeof j.result) : String(j.error).slice(0, 90) });
    } catch (e) { out.push({ fn, ok: false, msg: 'EXC ' + String(e).slice(0, 80) }); }
  }
  return out;
}, fns);
let pass = 0, fail = 0;
for (const r of res) {
  if (r.ok) { pass++; console.log(`✅ ${r.fn.padEnd(14)} ${r.msg}`); }
  else { fail++; console.log(`❌ ${r.fn.padEnd(14)} ${r.msg}`); }
}
console.log(`\n=== RPC PASS=${pass} FAIL=${fail} / ${fns.length} ===`);
await b.close();
