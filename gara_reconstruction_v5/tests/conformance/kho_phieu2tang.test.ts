/**
 * kho_phieu2tang.test.ts — W1a PHIẾU NHẬP/XUẤT 2 TẦNG (PLAN_HOI_TU_01.09, Wave 1.1, trục KHO)
 *
 * Kiểm chứng thiết kế TỐI GIỂU đã chốt:
 *  - KHÔNG có bảng header riêng; effective group id = COALESCE(NULLIF(phieu_id,''), id)
 *  - dmNhap 3 dòng → MỘT nhóm phieu_id (id dòng đầu), header suy từ dòng đầu
 *  - nhapKho/xuatKho đơn dòng → phieu_id tự tham chiếu → nhóm 1 dòng
 *  - dòng legacy trước W1a (phieu_id='') → eff = id → VẪN hiện (tương thích lùi)
 *  - phieuList filter {loai, sc_id, from, to} + phân trang limit≤200 + total
 *  - phieuGet(id) → header + lines JOIN vattu (ten/don_vi); nhóm không tồn tại → '404'
 *  - RBAC: phieuList/phieuGet = ['kho','xem'] (giamdoc/xuong/ketoan/kho đều có kho.xem),
 *    KHÔNG thuộc OPEN → không cookie vẫn 401.
 *
 * HTTP /api/rpc + cookie sid — pattern kế thừa kho_race.test.ts (server sạch
 * per-file do globalSetup DROP/CREATE trước mỗi suite).
 */
import request from 'supertest';
import { getAdminToken, getKhoToken, getGiamdocToken } from './setup';
import { db } from '../../lib/db';
import { getRegistry } from '../../lib/rpc';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });
const anon = (fn: string, args: any = {}) => request(BASE).post('/api/rpc').send({ fn, args });

const today = () => new Date().toISOString().split('T')[0];

/** body = {ok:true, result:<dispatch-return>}; dispatch-handler phieuList trả {ok,result,total} */
function unwrapList(res: any) {
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  const payload = res.body.result; // {ok:true, result:[nhóm...], total}
  expect(payload.ok).toBe(true);
  expect(Array.isArray(payload.result)).toBe(true);
  return payload as { ok: true; result: any[]; total: number };
}

jest.setTimeout(60000);

describe('W1a Phiếu nhập/xuất 2 tầng — phieuList/phieuGet + dmNhap theo nhóm', () => {
  const VT_GIAGOC = [1000, 2000, 1500];
  const VT_SLUONG = [2, 3, 4];
  let scId: string;
  let vtIds: string[] = [];
  let dmId: string;
  let phieuDmId: string; // eff = id dòng đầu nhóm DM
  const dmTong = VT_GIAGOC.reduce((s, g, i) => s + g * VT_SLUONG[i], 0); // 2·1000+3·2000+4·1500 = 14000

  beforeAll(async () => {
    const xe = await db.query(`SELECT id FROM xe WHERE deleted_at = '' ORDER BY id LIMIT 1`);
    expect(xe.rows.length).toBeGreaterThan(0);
    const scRes = await rpc(getAdminToken(), 'scCreate', { xe_id: xe.rows[0].id, ngay: today() });
    expect(scRes.body.ok).toBe(true);
    scId = scRes.body.result.id;

    const admin = getAdminToken();
    for (let i = 0; i < 3; i++) {
      const r = await rpc(admin, 'vattuCreate', { ten: `W1a Phieu VT${i + 1}`, don_vi: 'cái', gia: VT_GIAGOC[i], ton_min: 0 });
      expect(r.body.ok).toBe(true);
      vtIds.push(r.body.result.id);
    }
  });

  test('(a) dmCreate 3 items → dmNhap → ĐÚNG 1 nhóm so_dong=3, tong đúng; phieuGet khớp', async () => {
    const dmRes = await rpc(getKhoToken(), 'dmCreate', {
      sc_id: scId,
      ngay: today(),
      items: vtIds.map((v, i) => ({ vattu_id: v, so_luong: VT_SLUONG[i], don_gia: VT_GIAGOC[i] })),
    });
    expect(dmRes.body.ok).toBe(true);
    dmId = dmRes.body.result.id;

    const nhapRes = await rpc(getKhoToken(), 'dmNhap', { dm_id: dmId });
    expect(nhapRes.body.ok).toBe(true);

    // Lọc sc_id HẸP (phiếu DM gắn sc vừa tạo) → không nhóm khác chen vào được
    const list = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'nhap', sc_id: scId }));
    expect(list.result).toHaveLength(1);
    expect(list.total).toBe(1);
    const g = list.result[0];
    expect(String(g.id)).toMatch(/^NX-\d{6}$/);
    expect(g.loai).toBe('nhap');
    expect(g.so_dong).toBe(3);
    expect(Number(g.tong_tien)).toBe(dmTong);
    expect(g.ngay).toBe(today());
    expect(g.sc_id).toBe(scId);
    phieuDmId = g.id;

    const get = await rpc(getKhoToken(), 'phieuGet', { id: phieuDmId });
    expect(get.status).toBe(200);
    const det = get.body.result.result; // {header, lines, so_dong, tong_tien}
    expect(det.header.id).toBe(phieuDmId);
    expect(det.header.loai).toBe('nhap');
    expect(det.header.ngay).toBe(today());
    expect(det.header.ly_do).toBe(`Nhập DM ${dmId}`);
    expect(det.so_dong).toBe(3);
    expect(Number(det.tong_tien)).toBe(dmTong);
    // header = dòng ĐẦU nhóm → id dòng đầu đúng bằng eff, và 3 dòng JOIN ten khớp vattu
    const lines = det.lines.map((l: any) => ({ id: l.id, ten: l.ten, sl: l.so_luong }));
    expect(lines[0].id).toBe(phieuDmId);
    for (let i = 0; i < 3; i++) {
      expect(lines[i].ten).toBe(`W1a Phieu VT${i + 1}`);
      expect(lines[i].sl).toBe(VT_SLUONG[i]);
    }
    expect(det.lines.length).toBe(3);
    expect(new Set(det.lines.map((l: any) => l.vattu_id)).size).toBe(3); // 3 vattu phân biệt

    // tồn đã tăng đúng sau dmNhap (không đổi hành vi W0)
    const ton = await db.query('SELECT ton FROM vattu WHERE id = ANY($1)', [vtIds]);
    ton.rows.sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
    expect(ton.rows.map((r: any) => Number(r.ton))).toEqual(VT_SLUONG);
  });

  test('(b) nhapKho đơn dòng = nhóm 1 dòng (tự tham chiếu) + tương thích lùi dòng legacy phieu_id=\'\'', async () => {
    const inRes = await rpc(getKhoToken(), 'nhapKho', {
      vattu_id: vtIds[0], so_luong: 5, don_gia: 100, ngay: today(), ly_do: 'W1a don dong',
    });
    expect(inRes.body.ok || inRes.body.error).toBe(true);
    const nxId: string = inRes.body.result.id;

    const list = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'nhap', from: today(), to: today() }));
    const mine = list.result.find((x) => x.id === nxId);
    expect(mine).toBeDefined();
    expect(mine.so_dong).toBe(1);
    expect(Number(mine.tong_tien)).toBe(500); // 5 × 100

    // Dòng LEGACY kiểu trước W1a: chèn thẳng NOT có phieu_id (default '') →
    // eff COALESCE(NULLIF('',''), id) = id → nhóm 1 dòng VẪN xuất hiện.
    await db.query(
      "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,don_gia,ngay,ly_do) VALUES ('NX-900000',$1,'nhap',7,300,$2,'legacy pre-W1a')",
      [vtIds[1], today()]
    );
    const legacy = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'nhap', from: today() }));
    const lg = legacy.result.find((x) => x.id === 'NX-900000');
    expect(lg).toBeDefined();
    expect(lg.so_dong).toBe(1);
    expect(Number(lg.tong_tien)).toBe(2100);
    const lgGet = await rpc(getKhoToken(), 'phieuGet', { id: 'NX-900000' });
    expect(lgGet.body.result.result.lines[0].ten).toBe('W1a Phieu VT2');
  });

  test('(c) xuatKho gán phieu_id = chính nó; phieuList(loai=xuat) group đúng', async () => {
    const outRes = await rpc(getKhoToken(), 'xuatKho', {
      vattu_id: vtIds[2], so_luong: 2, sc_id: scId, ly_do: 'W1a xuat gan sc',
    });
    expect(outRes.body.ok || outRes.body.error).toBe(true);
    const outId: string = outRes.body.result.id;

    const xList = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'xuat', sc_id: scId }));
    expect(xList.result).toHaveLength(1);
    expect(xList.result[0].id).toBe(outId); // eff = id tự tham chiếu
    expect(xList.result[0].so_dong).toBe(1);
    expect(xList.total).toBe(1);

    // DB guard: phieu_id được ghi = id chính dòng (column tồn tại thật, không chỉ eff)
    const rowDb = await db.query('SELECT phieu_id, ncc FROM nhap_xuat WHERE id = $1', [outId]);
    expect(rowDb.rows[0].phieu_id).toBe(outId);
    expect(rowDb.rows[0].ncc).toBeNull(); // cột header mới, trống với phiếu đơn dòng

    // xuat không sc_id → eff = id; nhóm đứng riêng, sc_id null
    const out2 = await rpc(getKhoToken(), 'xuatKho', { vattu_id: vtIds[2], so_luong: 1, ly_do: 'W1a xuat tran' });
    expect(out2.body.ok).toBe(true);
    const all = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'xuat' }));
    const t = all.result.find((x) => x.id === out2.body.result.id);
    expect(t).toBeDefined();
    expect(t.sc_id).toBeNull();
    expect(t.so_dong).toBe(1);
  });

  test('(d) phân quyền: kho/giamdoc doc OK; anon 401; fn moi KHONG OPEN; param validate', async () => {
    // đọc phiếu DM bằng 2 role có kho.xem
    for (const tok of [getKhoToken(), getGiamdocToken()]) {
      const r = unwrapList(await rpc(tok, 'phieuList', { loai: 'nhap', sc_id: scId }));
      expect(r.result.find((x) => x.id === phieuDmId)?.so_dong).toBe(3);
      const g = await rpc(tok, 'phieuGet', { id: phieuDmId });
      expect(g.status).toBe(200);
    }
    // không cookie → vẫn 401 (fn không OPEN)
    const noAuth = await anon('phieuList', {});
    expect(noAuth.status).toBe(401);

    // static registry: có META, không OPEN
    const reg = getRegistry();
    expect(reg.OPEN.has('phieuList')).toBe(false);
    expect(reg.OPEN.has('phieuGet')).toBe(false);
    expect(reg.FN_LIST).toContain('phieuList');
    expect(reg.FN_LIST).toContain('phieuGet');

    // validate input (zod ở MCP layer + core guard ở HTTP)
    const badLoai = await rpc(getKhoToken(), 'phieuList', { loai: 'khong_losai' });
    expect(badLoai.status).toBe(400);
    expect(String(badLoai.body.error)).toMatch(/loai/);
    const badLimit = await rpc(getKhoToken(), 'phieuList', { limit: 9999 });
    expect(badLimit.status).toBe(400);
    expect(String(badLimit.body.error)).toMatch(/limit/);
    const badDate = await rpc(getKhoToken(), 'phieuList', { from: '31-12-2026' });
    expect(badDate.status).toBe(400);
    // 404-nhóm-không-tồn-tại: route map về 400, mã 404 nằm trong message
    const miss = await rpc(getKhoToken(), 'phieuGet', { id: 'NX-999999' });
    expect(miss.status).toBe(400);
    expect(String(miss.body.error)).toContain('404');
  });

  test('(e) pagination: limit cắt số nhóm, total không đổi theo trang', async () => {
    const page1 = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'nhap', limit: 1, offset: 0 }));
    const page2 = unwrapList(await rpc(getKhoToken(), 'phieuList', { loai: 'nhap', limit: 1, offset: 1 }));
    expect(page1.result).toHaveLength(1);
    expect(page2.result.length).toBeLessThanOrEqual(1);
    expect(page1.total).toBe(page2.total);
    expect(page1.total).toBeGreaterThanOrEqual(2); // nhóm DM + đơn-dòng + legacy
    const ids = new Set([...page1.result, ...page2.result].map((x) => x.id));
    expect(ids.size).toBe(page1.result.length + page2.result.length); // không trùng trang
  });
});
