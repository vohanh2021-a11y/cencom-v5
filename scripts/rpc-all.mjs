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

const fns = [
  'userAdd','userSetPassword','userSetActive','permMatrix','permSave','thresholdsSet','previewStart','previewStop','previewState',
  'scCreate','scList','scGet','scApprove','scStart','scSetDeadline','scWorkSet','scWorkAdd','scWorkDel','scVtAdd','scVtUpd','scVtDel','scFinish','scNghiem','scTongDuyet',
  'vatTuList','vatTuSave','vatTuDel','tonKho',
  'phNhapList','phNhapGet','phNhapCreate','phXuatList','phXuatGet','phXuatCreate','giaLichSuList','thanhLyList','autoGenCuHong',
  'dmList','dmDetail','dmCreate','dmFromSC','dmFromBaoGia','dmAutoBu','dmDecide','dmDelete','dmListBySc',
  'quyetToan','lichSuaList','assetXe','assetReport','ncNgoaiReport',
  'chatPeers','chatThreadOpen','chatList','chatMessages','chatSend','chatSendImg','chatMarkRead','chatUnreadCount','chatDeleteMsg',
  'deXuatCreate','deXuatList','deXuatGet','deXuatApprove','deXuatToSC',
  'xuongDashboard','dashboardAll',
  'baoGiaList','baoGiaGet','baoGiaCreate','baoGiaConfirm','baoGiaDel','baoGiaCompare',
  'nhanKyList','nhanKySet','checkHoSo','welcomeData',
  'currentUser','changePassword','appInfo','myPerms','roleOptions','thresholds','vehiclesOptions','phongbanList','checklistGroups','formInitData',
  'previewInfo','previewHome','previewSC','previewKho','previewDM','congViecList','fleetReport','accountingReport'
];

const res = await p.evaluate(async (fns) => {
  const out = [];
  for (const fn of fns) {
    try {
      const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn, args: [] }) });
      const j = await r.json();
      out.push({ fn, ok: !!j.ok, err: j.ok ? '' : String(j.error || '').slice(0, 70) });
    } catch (e) { out.push({ fn, ok: false, err: 'EXC ' + String(e).slice(0, 60) }); }
  }
  return out;
}, fns);

let missing = [], ok = 0, other = [];
for (const r of res) {
  if (r.ok) ok++;
  else if (/không tồn tại/i.test(r.err)) missing.push(r.fn);
  else other.push(r.fn + ': ' + r.err);
}
console.log(`✅ OK (handler chạy): ${ok}/${fns.length}`);
console.log(`\n🔴 THIẾU HANDLER (${missing.length}):`); missing.forEach(x => console.log('   - ' + x));
console.log(`\n🟠 CÓ handler nhưng lỗi (cần args/data - thường bình thường): ${other.length}`);
other.slice(0, 40).forEach(x => console.log('   - ' + x));
await b.close();
