/**
 * in_a4.test.ts — W4.3: IN HTML A4 (/in/[type]/[id]) + EXPORT CSV-safe.
 *
 * Chạy chống Next dev-server THẬT (TEST_BASE_URL hoặc http://localhost:3000):
 *  1) /in/kehoach/SC-… 200 + chứa 'Mẫu' + số chứng từ + dòng tiền.
 *  2) /in/kiemtu/SC-… 200 + XSS: mo_ta chứa <script> → escaped trong HTML
 *     (KHÔNG có literal '<script>…</script>' từ dữ liệu; có '&lt;script&gt;').
 *  3) /in không session → redirect /login (3xx).
 *  4) /api/export/tonghop CSV → 200 + X-Export-Format: csv + header id,bien_so.
 *  5) /api/export/bangke?id=SC → 200 + 'BẢNG KÊ'.
 *  6) export không session → 401.
 *
 * Dữ liệu tạo qua RPC với admin (is_test=1) — sau suite dọn theo id đã ghi.
 */
import request from 'supertest';
import { getAdminToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE)
    .post('/api/rpc')
    .set('Cookie', [`sid=${token}`])
    .send({ fn, args });

const today = () => new Date().toISOString().split('T')[0];
const XSS_MARK = 'XSS-9Q7';
const XSS_INJECT = `<script>alert(1)/*${XSS_MARK}*/</script>`;

let scId = '';
let bgId = '';
let vattuTestId = '';
let phieuNhapId = '';
let phieuXuatId = '';

beforeAll(async () => {
  // 1 xe + 1 vattu test (is_test=1 — ẩn khỏi list seed)
  const xeRes = await rpc(getAdminToken(), 'xeList');
  expect(xeRes.body.ok).toBe(true);
  expect(xeRes.body.result.length).toBeGreaterThan(0);
  const xeId = xeRes.body.result[0].id;

  const vtRes = await rpc(getAdminToken(), 'vattuCreate', { ten: 'VT in A4 test 100%', don_vi: 'cái', gia: 100000 });
  expect(vtRes.body.ok).toBe(true);
  vattuTestId = vtRes.body.result.id;

  // 2. SC + dòng (cv mang nội dung XSS để test escape khi in)
  const scRes = await rpc(getAdminToken(), 'scCreate', { xe_id: xeId, ngay: today() });
  expect(scRes.body.ok).toBe(true);
  scId = scRes.body.result.id;

  const cvRes = await rpc(getAdminToken(), 'scAddCongViec', {
    sc_id: scId,
    mo_ta: `Thay má phanh ${XSS_INJECT} xong`,
    loai_xu_ly: 'thay_moi',
    so_luong: 2,
    don_gia: 150000,
  });
  expect(cvRes.body.ok).toBe(true);
  const vtLine = await rpc(getAdminToken(), 'scAddVatTu', {
    sc_id: scId,
    vattu_id: vattuTestId,
    so_luong: 3,
    gd_dk: 100000,
  });
  expect(vtLine.body.ok).toBe(true);

  // 3. bộ phiếu bước: kế hoạch, kiểm tu, nghiệm thu, báo giá
  expect((await rpc(getAdminToken(), 'keHoachSave', { sc_id: scId, mo_ta: `Kế hoạch ${XSS_INJECT}` })).body.ok).toBe(true);
  expect((await rpc(getAdminToken(), 'kiemTuSave', { sc_id: scId, mo_ta: 'Kiểm tu A4 test' })).body.ok).toBe(true);
  expect(
    (await rpc(getAdminToken(), 'nghiemThuSave', { sc_id: scId, ngay_nghiem: today(), tong_vat_tu: 300000, tong_nhan_cong: 300000 }))
      .body.ok
  ).toBe(true);
  const bgRes = await rpc(getAdminToken(), 'baogiaSave', {
    sc_id: scId,
    ncc: '=NCC"TEST', // chuỗi bắt đầu '=' + chứa " → test CSV escape + formula-guard
    ngay: today(),
    items: [{ ten: 'Phụ tùng in', so_luong: 2, don_gia: 200000 }],
  });
  expect(bgRes.body.ok).toBe(true);
  bgId = bgRes.body.result.id;

  // 4. nhập + xuất kho gắn SC (mẫu 4/5 cần phiếu NX-)
  const nhap = await rpc(getAdminToken(), 'nhapKho', {
    vattu_id: vattuTestId,
    so_luong: 5,
    don_gia: 100000,
    ngay: today(),
    ncc: 'NCC nhập test',
    sc_id: scId,
  });
  expect(nhap.body.ok).toBe(true);
  phieuNhapId = nhap.body.result.id;
  const xuat = await rpc(getAdminToken(), 'xuatKho', {
    vattu_id: vattuTestId,
    so_luong: 1,
    ngay: today(),
    sc_id: scId,
    ly_do: 'Xuất cho SC A4 test',
  });
  expect(xuat.body.ok).toBe(true);
  phieuXuatId = xuat.body.result.id;
});

afterAll(async () => {
  // Dọn theo id đã ghi (thứ tự FK: con → cha)
  if (phieuNhapId) await db.query('DELETE FROM nhap_xuat WHERE id=$1', [phieuNhapId]);
  if (phieuXuatId) await db.query('DELETE FROM nhap_xuat WHERE id=$1', [phieuXuatId]);
  if (scId) {
    await db.query('DELETE FROM activity_log WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM sc_congviec WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM sc_vattu WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM ke_hoach_sc WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM phieu_kiem_tu WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM bien_ban_nghiem WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM bao_gia_ncc WHERE sc_id=$1', [scId]);
    await db.query("DELETE FROM baogia_chitiet WHERE baogia_id IN (SELECT id FROM baogia WHERE sc_id=$1)", [scId]);
    await db.query('DELETE FROM baogia WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM ho_so WHERE sc_id=$1', [scId]);
    await db.query('DELETE FROM sc WHERE id=$1', [scId]);
  }
  if (vattuTestId) {
    await db.query('DELETE FROM vattu_gia_lich_su WHERE vattu_id=$1', [vattuTestId]);
    await db.query('DELETE FROM vattu WHERE id=$1', [vattuTestId]);
  }
  console.log('✅ in_a4 cleanup xong');
});

const get = (token: string, path: string) => request(BASE).get(path).set('Cookie', [`sid=${token}`]);

describe('W4.3 — IN HTML A4 (/in/[type]/[id])', () => {
  test('GET /in/kehoach/<SC> → 200, chứa "Mẫu", số phiếu và tiền dạng VN', async () => {
    const res = await get(getAdminToken(), `/in/kehoach/${scId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('KẾ HOẠCH SỬA CHỮA');
    expect(res.text).toContain('Mẫu 1/8');
    expect(res.text).toContain(scId); // số phiếu hiện trên trang
    expect(res.text).toContain('150.000'); // vnd(2*150000=300.000) → có group '.'
    expect(res.text).toContain('300.000');
    // số tiền bằng chữ (sotienChu port v3.6): 600.000đ → 'Sáu trăm nghìn đồng'
    expect(res.text).toMatch(/Sáu trăm nghìn đồng/);
  });

  test('GET /in/kiemtu/<SC> → 200 + XSS trong mo_ta được ESCAPE (không có <script> thô)', async () => {
    const res = await get(getAdminToken(), `/in/kiemtu/${scId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('BẢN KIỂM TU SỬA CHỮA');
    // marker vẫn hiển thị (chứng từ được in), nhưng tag script phải bị escape
    expect(res.text).toContain(XSS_MARK);
    // KHÔNG được tồn tại thẻ script nguyên vẹn BẤT KỲ đâu từ dữ liệu: chỉ 1 script hợp lệ
    // do Next inject (RSC payload không chứa '<script>alert(1)').
    expect(res.text).not.toContain('<script>alert(1)');
    expect(res.text).toContain('&lt;script&gt;');
  });

  test('GET /in/bangke/<SC> → 200 + bảng 9 cột + tổng tiền bằng chữ', async () => {
    const res = await get(getAdminToken(), `/in/bangke/${scId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('BẢNG KÊ CHI TIẾT');
    expect(res.text).toContain('Mẫu 8/8');
    expect(res.text).toContain('Tên công việc / Vật tư');
    // tong = cv(2×150.000=300.000) + vt(3×100.000=300.000) = 600.000 đ
    expect(res.text).toContain('Sáu trăm nghìn đồng');
  });

  test('GET /in/baogia/<BG> + /in/baogia/<SC-dùng-hộ> → 200', async () => {
    const r1 = await get(getAdminToken(), `/in/baogia/${bgId}`);
    expect(r1.status).toBe(200);
    expect(r1.text).toContain('PHIẾU MUA VẬT TƯ (BÁO GIÁ)');
    const r2 = await get(getAdminToken(), `/in/baogia/${scId}`);
    expect(r2.status).toBe(200);
    expect(r2.text).toContain(bgId); // giải SC→BG gần nhất
  });

  test('GET /in/nhapkho/<NX> + /in/xuatkho/<NX> → 200 đúng tiêu đề', async () => {
    const rn = await get(getAdminToken(), `/in/nhapkho/${phieuNhapId}`);
    expect(rn.status).toBe(200);
    expect(rn.text).toContain('PHIẾU NHẬP KHO VẬT TƯ');
    const rx = await get(getAdminToken(), `/in/xuatkho/${phieuXuatId}`);
    expect(rx.status).toBe(200);
    expect(rx.text).toContain('PHIẾU XUẤT KHO VẬT TƯ');
  });

  test('GET /in/nghiemthu/<SC> + /in/hoso/<SC> (8 bước gộp) → 200', async () => {
    const rr = await get(getAdminToken(), `/in/nghiemthu/${scId}`);
    expect(rr.status).toBe(200);
    expect(rr.text).toContain('BIÊN BẢN NGHIỆM THU');
    const rh = await get(getAdminToken(), `/in/hoso/${scId}`);
    expect(rh.status).toBe(200);
    // hồ sơ chứa nhiều mẫu: kế hoạch + bảng kê + bước checklist
    expect(rh.text).toContain('KẾ HOẠCH SỬA CHỮA');
    expect(rh.text).toContain('BẢNG KÊ CHI TIẾT');
    expect(rh.text).toContain('ĐẠT');
  });

  test('không có session → redirect /login (không lộ dữ liệu)', async () => {
    const res = await request(BASE).get(`/in/kehoach/${scId}`).redirects(0);
    expect([301, 302, 303, 307, 308]).toContain(res.status);
    expect(String(res.headers.location || '')).toContain('/login');
    // payload redirect KHÔNG chứa block chứng từ thật (dữ liệu không lộ)
    expect(res.text || '').not.toContain('KẾ HOẠCH SỬA CHỮA');
  });

  test('type lạ / id sai dạng → 404 không crash', async () => {
    const badType = await get(getAdminToken(), '/in/khongco/SC-000001');
    expect(badType.status).toBe(404);
    const badId = await get(getAdminToken(), '/in/kehoach/SC-abc');
    expect(badId.status).toBe(404);
  });
});

describe('W4.3 — EXPORT (CSV-safe; xlsx TODO khi được duyệt dep)', () => {
  test('GET /api/export/tonghop → 200 text/csv + BOM + cột chuẩn', async () => {
    const res = await get(getAdminToken(), '/api/export/tonghop');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['x-export-format']).toBe('csv');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const body = res.text.replace(/^\uFEFF/, '');
    expect(body).toContain('id,bien_so,trang_thai');
  });

  test('GET /api/export/bangke?id=<SC> → 200 csv chứa tiêu đề bảng kê; ncc "=..." được escape chống formula', async () => {
    const res = await get(getAdminToken(), `/api/export/bangke?id=${scId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('BẢNG KÊ CHI TIẾT');
    // chuỗi bắt đầu '=' → csvCell prefix `'` (chặn Excel formula injection), " nhân đôi
    const r2 = await get(getAdminToken(), `/api/export/baogia?id=${bgId}`);
    expect(r2.status).toBe(200);
    expect(r2.text).toContain("\"'=NCC\"\"TEST\"");
  });

  test('GET /api/export/tonkho → 200 csv danh mục vật tư', async () => {
    const res = await get(getAdminToken(), '/api/export/tonkho');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id,ten,don_vi,ton');
  });

  test('export không session → 401; type lạ → 404', async () => {
    const r0 = await request(BASE).get('/api/export/tonghop');
    expect(r0.status).toBe(401);
    const rl = await get(getAdminToken(), '/api/export/xxxxx');
    expect(rl.status).toBe(404);
    const rn = await get(getAdminToken(), '/api/export/bangke');
    expect(rn.status).toBe(400);
  });
});
