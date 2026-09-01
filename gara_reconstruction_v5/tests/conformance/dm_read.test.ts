/**
 * dm_read.test.ts — W2a DM (đề nghị mua) READ + SOFT-DELETE (PLAN_HOI_TU WAVE 2.1,
 * trục MUA SẮM). Nguồn port: v3.6 kho.js dmList/dmDetail/dmListBySc/dmDelete.
 *
 * Kiểm chứng theo schema v5 THẬT (db/schema.sql):
 *  - dmList: header `dm` + so_dong subquery dm_chitiet; phân trang page/limit≤200
 *    + total; lọc trang_thai (CHECK 3 giá trị) + from/to YYYY-MM-DD; LIST lọc
 *    is_test=0 (pattern scList/baogiaList) trong khi dmDetail-theo-id KHÔNG lọc
 *    (pattern scGet/vattuGet).
 *  - dmDetail: header dm + items JOIN vattu (ten/don_vi — cột KHÔNG denormalize
 *    ở dm_chitiet v5, khác v3.6); id mất/xóa mềm → envelope error cố định.
 *  - dmListBySc: liên kết qua HEADER `dm.sc_id` — v5 KHÔNG có ref_dm per-column
 *    (ghi chú bàn giao); dmNhap copy sc_id xuống phiếu nên nhánh "đã nhập" baođược.
 *  - dmDelete: chỉ khi trang_thai='cho_duyet' VÀ chưa có phiếu nhập nhận diện
 *    qua ly_do = 'Nhập DM <id>' (dấu vết dmNhap ghi buộc); xóa mềm deleted_at;
 *    sau dmNhap → {ok:false,'Không xoá được: đã có phiếu nhập'}.
 *  - W2c (siết theo v3.6 phNhapCreate:341-343): dmNhap CHỈ khi DM 'da_duyet' →
 *    test (6) phải giamdoc dmDecide 'duyet' trước khi nhập; dmDetail expose
 *    thêm nguoi_duyet/ngay_duyet/ly_do vào header (test (2) kiểm giá trị '').
 *  - Envelope lỗi input {ok:false,error} HTTP 200 (quy ước hàm mới W1b+, khác
 *    phieuList throw/400 cũ).
 *  - RBAC: 3 fn đọc ['kho','xem'] (giamdoc OK), dmDelete ['kho','sua']
 *    (giamdoc/xuong/ketoan → 403; kho role → có 'sua' ALLOW path), anon 401,
 *    không fn nào OPEN.
 *
 * HTTP /api/rpc + cookie sid — pattern kế thừa kho_phieu2tang.test.ts (server
 * :3000 spawn/kill ngoài jest theo scripts/test-conformance.mjs; globalSetup
 * DROP/CREATE + migrate + seed sạch DB cho cả lượt chạy).
 */
import request from 'supertest';
import { getAdminToken, getKhoToken, getGiamdocToken } from './setup';
import { db } from '../../lib/db';
import { getRegistry } from '../../lib/rpc';
import { RPC_SCHEMAS } from '../../lib/contracts';
import { PART4 } from '../../mcp-server/tool-docs.part4';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });
const anon = (fn: string, args: any = {}) => request(BASE).post('/api/rpc').send({ fn, args });

const today = () => new Date().toISOString().split('T')[0];
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().split('T')[0];

/** body = {ok:true,result:<envelope core trả về>}; core W2a LUÔN envelope {ok,...} */
async function callOk(res: any, fn: string) {
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  const payload = res.body.result;
  expect(payload && typeof payload.ok === 'boolean').toBe(true);
  return payload as any;
}

jest.setTimeout(60000);

describe('W2a DM đọc — dmList/dmDetail/dmListBySc + dmDelete soft (port v3.6)', () => {
  const VT = [
    { ten: 'W2a DM Lọc GIÓ', don_vi: 'cái', sl: 2, gia: 1000 },
    { ten: 'W2a DM Dầu MÁY', don_vi: 'lít', sl: 3, gia: 2000 },
  ];
  const DM_A_TONG = VT.reduce((s, v) => s + v.sl * v.gia, 0); // 8000
  let scId: string;
  let vtIds: string[] = [];
  let dmA: string; // có sc_id, 2 items → sẽ dmNhap
  let dmB: string; // không sc_id → xóa được khi cho_duyet
  let dmC: string; // admin tạo → is_test=1, ẩn khỏi dmList
  let dmD: string; // tu_choi (đặt bằng SQL thẳng — dmDecide thuộc W2b)

  beforeAll(async () => {
    const xe = await db.query(`SELECT id FROM xe WHERE deleted_at = '' ORDER BY id LIMIT 1`);
    expect(xe.rows.length).toBeGreaterThan(0);
    const scRes = await rpc(getAdminToken(), 'scCreate', { xe_id: xe.rows[0].id, ngay: today() });
    expect(scRes.body.ok).toBe(true);
    scId = scRes.body.result.id;

    const kho = getKhoToken();
    for (const v of VT) {
      const r = await rpc(kho, 'vattuCreate', { ten: v.ten, don_vi: v.don_vi, gia: v.gia, ton_min: 0 });
      expect(r.body.ok).toBe(true);
      vtIds.push(r.body.result.id);
    }
  });

  test('(0) registry: FN_LIST chứa 4 fn, không OPEN, META/contracts/docs khớp', () => {
    const reg = getRegistry();
    const FNS = ['dmList', 'dmDetail', 'dmListBySc', 'dmDelete'];
    for (const fn of FNS) {
      expect(reg.FN_LIST).toContain(fn);
      expect(reg.OPEN.has(fn)).toBe(false);
      expect(reg.META[fn]).toBeDefined();
      expect(RPC_SCHEMAS[fn]).toBeDefined();
      expect(PART4[fn]).toBeDefined();
    }
    expect(reg.META.dmList).toEqual(['kho', 'xem']);
    expect(reg.META.dmDetail).toEqual(['kho', 'xem']);
    expect(reg.META.dmListBySc).toEqual(['kho', 'xem']);
    expect(reg.META.dmDelete).toEqual(['kho', 'sua']);
    // dmDelete là WRITE duy nhất — docs + READ_TOOLS phải phản ánh đúng
    expect(PART4.dmDelete.mode).toBe('WRITE');
    expect(PART4.dmList.mode).toBe('READ');
  });

  test('(1) dmCreate → dmList: xuất hiện, đủ field contract, đúng tong/so_dong', async () => {
    const mk = async (token: string, sc: string | undefined) => {
      const r = await rpc(token, 'dmCreate', {
        sc_id: sc,
        ngay: today(),
        items: vtIds.map((v, i) => ({ vattu_id: v, so_luong: VT[i].sl, don_gia: VT[i].gia })),
      });
      expect(r.body.ok).toBe(true);
      return r.body.result.id as string;
    };
    dmA = await mk(getKhoToken(), scId);
    dmB = await mk(getKhoToken(), undefined);
    dmC = await mk(getAdminToken(), undefined); // admin → is_test=1

    const list = await callOk(await rpc(getKhoToken(), 'dmList'), 'dmList');
    expect(Array.isArray(list.result)).toBe(true);
    const row = list.result.find((x: any) => x.id === dmA);
    expect(row).toBeDefined();
    // contract worker-e: {id, ma, trang_thai, tong, ngay_tao, so_dong, sc_id}
    expect(Object.keys(row).sort()).toEqual(
      ['id', 'ma', 'ngay_tao', 'sc_id', 'so_dong', 'tong', 'trang_thai'].sort()
    );
    expect(row.ma).toBe(dmA);
    expect(row.ma).toMatch(/^DM-\d{6}$/); // v5 prefix 'DM' (v3.6 'DNM' — lệch schema thật)
    expect(row.trang_thai).toBe('cho_duyet');
    expect(Number(row.tong)).toBe(DM_A_TONG);
    expect(row.ngay_tao).toBe(today());
    expect(Number(row.so_dong)).toBe(2);
    expect(row.sc_id).toBe(scId);
    // is_test=0 filter: admin tạo không lẫn vào sổ (pattern scList/baogiaList)
    expect(list.result.find((x: any) => x.id === dmC)).toBeUndefined();
    expect(list.total).toBeGreaterThanOrEqual(2);
  });

  test('(2) dmDetail: header + items JOIN vattu (ten/don_vi/so_luong/don_gia)', async () => {
    const det = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: dmA }), 'dmDetail');
    expect(det.ok).toBe(true);
    expect(det.dm.id).toBe(dmA);
    expect(det.dm.trang_thai).toBe('cho_duyet');
    expect(Number(det.dm.tong)).toBe(DM_A_TONG);
    expect(det.dm.sc_id).toBe(scId);
    // W2c: dmDetail expose 3 cột duyệt — trạng thái cho_duyet → tất cả '' (default schema)
    expect(det.dm.nguoi_duyet).toBe('');
    expect(det.dm.ngay_duyet).toBe('');
    expect(det.dm.ly_do).toBe('');
    expect(det.items).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      expect(det.items[i].vattu_id).toBe(vtIds[i]);
      expect(det.items[i].ten).toBe(VT[i].ten);
      expect(det.items[i].don_vi).toBe(VT[i].don_vi);
      expect(Number(det.items[i].so_luong)).toBe(VT[i].sl);
      expect(Number(det.items[i].don_gia)).toBe(VT[i].gia);
    }
    // chi tiết theo id KHÔNG lọc is_test (pattern vattuGet/scGet) — admin vẫn đọc được
    const detC = await callOk(await rpc(getAdminToken(), 'dmDetail', { id: dmC }), 'dmDetail');
    expect(detC.ok).toBe(true);
    // id không tồn tại / đã xóa mềm → envelope cố định (lệch có chủ đích v3.6 null)
    const miss = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: 'ZZ-999999' }), 'dmDetail');
    expect(miss.ok).toBe(false);
    expect(miss.error).toBe('Không thấy đề nghị.');
  });

  test('(3) dmListBySc: header dm.sc_id bao cả DM đã nhập (dmNhap copy sc_id)', async () => {
    const bySc = await callOk(await rpc(getKhoToken(), 'dmListBySc', { sc_id: scId }), 'dmListBySc');
    expect(bySc.ok).toBe(true);
    expect(bySc.result.find((x: any) => x.id === dmA)).toBeDefined();
    expect(bySc.result.find((x: any) => x.id === dmB)).toBeUndefined(); // không sc_id
    const bad = await callOk(await rpc(getKhoToken(), 'dmListBySc', { sc_id: 123 }), 'dmListBySc');
    expect(bad.ok).toBe(false);
  });

  test('(4) filter trang_thai + from/to + phân trang page/limit', async () => {
    const kho = getKhoToken();
    const onlyPending = await callOk(await rpc(kho, 'dmList', { trang_thai: 'cho_duyet' }), 'dmList');
    expect(onlyPending.result.every((x: any) => x.trang_thai === 'cho_duyet')).toBe(true);
    expect(onlyPending.result.some((x: any) => x.id === dmA || x.id === dmB)).toBe(true);
    const noneRejected = await callOk(await rpc(kho, 'dmList', { trang_thai: 'tu_choi' }), 'dmList');
    expect(noneRejected.result.some((x: any) => x.id === dmA)).toBe(false);

    const future = await callOk(await rpc(kho, 'dmList', { from: tomorrow() }), 'dmList');
    expect(future.result.length).toBe(0);
    const until = await callOk(await rpc(kho, 'dmList', { to: tomorrow() }), 'dmList');
    expect(until.result.some((x: any) => x.id === dmA)).toBe(true);

    const p1 = await callOk(await rpc(kho, 'dmList', { page: 1, limit: 1 }), 'dmList');
    const p2 = await callOk(await rpc(kho, 'dmList', { page: 2, limit: 1 }), 'dmList');
    expect(p1.result).toHaveLength(1);
    expect(p2.result).toHaveLength(1);
    expect(p1.result[0].id).not.toBe(p2.result[0].id); // không trùng trang
    expect(p1.total).toBe(p2.total); // total không đổi giữa trang

    // lỗi input = envelope {ok:false} (HTTP 200 — hành vi hàm mới, không throw)
    // W2b: 'da_duyet' ĐÃ vào CHECK + whitelist → loc hop le (envelope ok:true,
    // mang DM trang thaif da_duyet). Gia tri ngoai whitelist van bi tu choi.
    const daDuyet = await callOk(await rpc(kho, 'dmList', { trang_thai: 'da_duyet' }), 'dmList');
    expect(daDuyet.ok).toBe(true);
    expect(Array.isArray(daDuyet.result)).toBe(true);
    const badTt = await callOk(await rpc(kho, 'dmList', { trang_thai: 'da_cho_duyet' }), 'dmList');
    expect(badTt.ok).toBe(false);
    expect(badTt.error).toMatch(/trang_thai/);
    const badFrom = await callOk(await rpc(kho, 'dmList', { from: '31-12-2026' }), 'dmList');
    expect(badFrom.ok).toBe(false);
    expect(badFrom.error).toMatch(/YYYY-MM-DD/);
    const badLimit = await callOk(await rpc(kho, 'dmList', { limit: 9999 }), 'dmList');
    expect(badLimit.ok).toBe(false);
    expect(badLimit.error).toMatch(/limit/);
    const badPage = await callOk(await rpc(kho, 'dmList', { page: 0 }), 'dmList');
    expect(badPage.ok).toBe(false);
    expect(badPage.error).toMatch(/page/);
  });

  test('(5) dmDelete: được khi cho_duyet & chưa nhập → deleted_at set; ẩn khỏi list/detail', async () => {
    const del = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: dmB }), 'dmDelete');
    expect(del.ok).toBe(true);
    const dbRow = await db.query('SELECT deleted_at FROM dm WHERE id = $1', [dmB]);
    expect(dbRow.rows.length).toBe(1);
    expect(String(dbRow.rows[0].deleted_at)).not.toBe(''); // soft-delete, không DELETE cứng
    const list = await callOk(await rpc(getKhoToken(), 'dmList'), 'dmList');
    expect(list.result.find((x: any) => x.id === dmB)).toBeUndefined();
    const det = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: dmB }), 'dmDetail');
    expect(det.ok).toBe(false);
    // xóa lần 2 (id đã soft-delete) → Không thấy đề nghị, không race deleted_at mới
    const again = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: dmB }), 'dmDelete');
    expect(again.ok).toBe(false);
    expect(again.error).toBe('Không thấy đề nghị.');
  });

  test('(6) dmDelete chặn khi đã có phiếu nhập (ly_do "Nhập DM <id>") + khi tu_choi', async () => {
    // W2c: dmNhap SIẾT theo v3.6 (phNhapCreate chặn ref_dm chưa duyệt) → DM phải
    // qua dmDecide 'duyet' (giamdoc) TRƯỚC khi nhập. Chặn ngay tại core, TRƯỚC
    // khi cộng ton; envelope {ok:false} qua HTTP 200 (pattern hàm mới W1b+).
    const pre = await callOk(await rpc(getKhoToken(), 'dmNhap', { dm_id: dmA }), 'dmNhap');
    expect(pre.ok).toBe(false);
    expect(pre.error).toMatch(/Chỉ nhập khi đề nghị đã duyệt/);
    const ap = await callOk(await rpc(getGiamdocToken(), 'dmDecide', { id: dmA, quyet: 'duyet' }), 'dmDecide');
    expect(ap.ok).toBe(true);
    const nhap = await rpc(getKhoToken(), 'dmNhap', { dm_id: dmA });
    expect(nhap.body.ok).toBe(true);
    expect(nhap.body.result.ok).toBe(true); // nhập thành công thật (không chỉ dispatch)

    const denied = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: dmA }), 'dmDelete');
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('Không xoá được: đã có phiếu nhập');
    // sau khi nhập, DM vẫn còn sống và vào dmListBySc với trạng thái da_nhap
    const bySc = await callOk(await rpc(getKhoToken(), 'dmListBySc', { sc_id: scId }), 'dmListBySc');
    expect(bySc.result.find((x: any) => x.id === dmA).trang_thai).toBe('da_nhap');

    // nhánh chặn theo TRẠNG THÁI (chưa có phiếu nhập nhưng không phải cho_duyet):
    // tu_choi đặt bằng SQL thẳng vì dmDecide là W2b — kiểm đúng guard lõi của hàm.
    const mkR = await rpc(getKhoToken(), 'dmCreate', { ngay: today(), items: [{ vattu_id: vtIds[0], so_luong: 1, don_gia: 10 }] });
    dmD = mkR.body.result.id;
    await db.query("UPDATE dm SET trang_thai = 'tu_choi' WHERE id = $1", [dmD]);
    const denied2 = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: dmD }), 'dmDelete');
    expect(denied2.ok).toBe(false);
    expect(denied2.error).toMatch(/chờ duyệt/);
  });

  test('(7) RBAC: đọc = kho.xem (giamdoc OK), xóa cần kho.sua (giamdoc 403), anon 401', async () => {
    for (const fn of ['dmList', 'dmDetail', 'dmListBySc']) {
      const args = fn === 'dmDetail' ? { id: dmA } : fn === 'dmListBySc' ? { sc_id: scId } : {};
      const r = await rpc(getGiamdocToken(), fn, args);
      expect(r.status).toBe(200);
      expect(r.body.result.ok).toBe(true);
    }
    // giamdoc KHÔNG có kho.sua → dmDelete 403 (META ['kho','sua'] fail-closed)
    const forb = await rpc(getGiamdocToken(), 'dmDelete', { id: dmA });
    expect(forb.status).toBe(403);
    // anon: cả 4 fn đều không OPEN → 401
    expect((await anon('dmList', {})).status).toBe(401);
    expect((await anon('dmDetail', { id: dmA })).status).toBe(401);
    expect((await anon('dmListBySc', { sc_id: scId })).status).toBe(401);
    expect((await anon('dmDelete', { id: 'DM-000001' })).status).toBe(401);
  });
});
