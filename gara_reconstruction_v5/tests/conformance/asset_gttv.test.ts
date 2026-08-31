/**
 * W1.6e — Conformance GTTV: lib/core/asset.ts (assetXe / assetReport / getKhauHaoNam).
 *
 * Port đối chiếu v3.6 `server/asset.js`:
 *   khauHaoNam() = Math.max(1, Number(config('khau_hao_nam', 10)) || 10)          [dòng 21]
 *   khauHao(xe)  = nguyen<=0 → 0;
 *                  soNam = max(0, nowY − (Number(nam_sx) || nowY)); round(nguyen/khn·min(soNam,khn)) [dòng 23–30]
 *   chiTichLuy   = SUM(tong)+COUNT của hồ sơ quyết toán — v5: sc.trang_thai='da_quyet' AND deleted_at='' [dòng 32]
 *   gttv         = max(0, nguyen_gia − khau_hao_luy_ke) + chi_phi_tich_luy (clamp theo spec W1.6e)
 *
 * Vì RPC `assetXe/assetReport` CHƯA đăng ký khi viết TC1–TC6 (W1.6e test core trực tiếp
 * qua `buildApi` — cùng helper route web/MCP dùng; W1.6f mới wire rpc.ts),
 * suite core tự cắm fixture bằng db.query/nextId (cùng thư viện với sc_totals.test.ts & kho_phieu2tang).
 * W1.6f bổ sung describe cuối file: gọi qua HTTP /api/rpc + cookie sid (đường khách thật).
 * So sánh tiền dùng dung sai ±1 (task chốt: Math.round, không đòi exact cent).
 *
 * Dữ liệu fixture: xe SC dùng is_test=1 (quy ước admin tạo ⇒ không lẫn số liệu thật);
 * riêng xe cho assetReport phải is_test=0 vì hàm lọc "xe hoạt động deleted_at='' AND is_test=0"
 * — vẫn mang bien_so đánh dấu W16E- để dọn sạch ở afterAll, không nhiễm suite khác.
 */
import request from 'supertest';
import { buildApi } from '../../lib/api';
import { db, nextId } from '../../lib/db';
import { getRegistry } from '../../lib/rpc';
import { getGiamdocToken, getKetoanToken } from './setup';
import { assetReport, assetXe, getKhauHaoNam, tinhKhauHao } from '../../lib/core/asset';

const api = buildApi({ id: 'U-ADMIN', name: 'admin', role: 'admin' });

/* ── HTTP helpers (W1.6f) — pattern sc_totals.test.ts / kho_phieu2tang.test.ts ── */
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });
const anon = (fn: string, args: any = {}) => request(BASE).post('/api/rpc').send({ fn, args });

const YEAR = new Date().getFullYear();
const today = () => new Date().toISOString().split('T')[0];
/** So sánh tiền dung sai ±1 (spec task) — tự ném Error kèm nhãn để fail dễ đọc */
function near(actual: number, expected: number, label = 'near'): void {
  const a = Number(actual);
  const e = Number(expected);
  if (!Number.isFinite(a) || Math.abs(a - e) > 1) {
    throw new Error(`${label}: |${actual} − ${expected}| = ${Math.abs(a - e)} > 1`);
  }
}

/** Đánh dấu riêng để not collision + dễ dọn */
const MARK = 'W16E' + String(Date.now()).slice(-6);

const createdXe: string[] = [];
const createdSc: string[] = [];

/** Cắm xe trực tiếp DB (xeCreate RPC đòi HTTP server; fixture cần control is_test/nam_sx tuỳ case). */
async function mkXe(
  tag: string,
  opts: { namSx: number | null; nguyenGia: number; isTest: number }
): Promise<string> {
  const id = await nextId('XE');
  await db.query(
    'INSERT INTO xe (id, bien_so, chu_xe, nam_sx, nguyen_gia, is_test, deleted_at) ' +
      "VALUES ($1,$2,$3,$4,$5,$6,'')",
    [id, `${MARK}-${tag}`, 'W16e fixture', opts.namSx, opts.nguyenGia, opts.isTest]
  );
  createdXe.push(id);
  return id;
}

/** Cắm SC trực tiếp DB (trang_thai/tong/deleted_at control theo từng case). */
async function mkSc(
  xeId: string,
  opts: { trangThai: string; tong: number; deleted?: boolean }
): Promise<string> {
  const id = await nextId('SC');
  await db.query(
    "INSERT INTO sc (id, xe_id, trang_thai, ngay_tao, nguoi_tao, tong_cong, tong_vt, tong, is_test, deleted_at) " +
      "VALUES ($1,$2,$3,$4,'U-ADMIN',0,0,$5,1,$6)",
    [id, xeId, opts.trangThai, today(), opts.tong, opts.deleted ? today() : '']
  );
  createdSc.push(id);
  return id;
}

afterAll(async () => {
  // Dọn fixture: soft-delete theo đúng chuẩn dữ liệu nghiệp vụ (không DELETE cứng),
  // riêng key config test thì xoá trả DB về trạng thái seed (key vốn KHÔNG tồn tại).
  if (createdSc.length)
    await db.query('UPDATE sc SET deleted_at=$1 WHERE id=ANY($2::text[])', [today(), createdSc]);
  if (createdXe.length)
    await db.query('UPDATE xe SET deleted_at=$1 WHERE id=ANY($2::text[])', [today(), createdXe]);
  await db.query("DELETE FROM config WHERE key='khau_hao_nam'");
});

describe('W1.6e — asset GTTV port v3.6 (lib/core/asset.ts)', () => {
  /* ── TC1: getKhauHaoNam fallback + tinhKhauHao thuần (không DB) ───────── */
  test('TC1 — config thiếu → 10; công thức khấu hao dòng đúng v3.6 (round, clamp năm, null/future nam_sx)', async () => {
    await db.query("DELETE FROM config WHERE key='khau_hao_nam'"); // DB seed không có key này
    expect(await getKhauHaoNam()).toBe(10);

    // 1 tỷ, xe 2 năm tuổi, khn=10 → 1e9/10*2 = 2e8 (round ra số chẵn)
    near(tinhKhauHao(1_000_000_000, YEAR - 2, 10), 200_000_000);
    // Nam_sx NULL / tương lai → soNam=0 → khấu hao 0 (port (Number(x)||now))
    expect(tinhKhauHao(1_000_000_000, null, 10)).toBe(0);
    expect(tinhKhauHao(1_000_000_000, YEAR + 5, 10)).toBe(0);
    // Số năm vượt khn → cap tại khn → khấu hao toàn bộ nguyên giá
    near(tinhKhauHao(1_000_000_000, YEAR - 99, 10), 1_000_000_000);
    // nguyen_gia <= 0 → 0 (early-return v3.6 dòng 25)
    expect(tinhKhauHao(0, YEAR - 5, 10)).toBe(0);
  });

  /* ── TC2: assetXe số nghiệm thu của task (2e8 / 250e6 / 1.05e9, chỉ da_quyet) ── */
  test('TC2 — assetXe: khau_hao 2e8 + chi_phi chỉ SC da_quyet 250M → gttv 1,05 tỷ; de_xuat & soft-delete KHÔNG tính', async () => {
    await db.query("DELETE FROM config WHERE key='khau_hao_nam'"); // fallback 10
    const xe = await mkXe('X2', { namSx: YEAR - 2, nguyenGia: 1_000_000_000, isTest: 1 });
    await mkSc(xe, { trangThai: 'da_quyet', tong: 100_000_000 });
    await mkSc(xe, { trangThai: 'da_quyet', tong: 150_000_000 });
    await mkSc(xe, { trangThai: 'de_xuat', tong: 999_000_000 }); // không được cộng
    await mkSc(xe, { trangThai: 'da_quyet', tong: 500_000_000, deleted: true }); // đã xoá mềm

    const res = await assetXe(api, { id: xe });
    expect(res.ok).toBe(true);
    const r = res.result;
    expect(r.xe_id).toBe(xe);
    expect(r.bien_so).toBe(`${MARK}-X2`);
    near(Number(r.nguyen_gia), 1_000_000_000, 'nguyen_gia');
    near(Number(r.khau_hao_luy_ke), 200_000_000, 'khau_hao_luy_ke=2e8');
    near(Number(r.chi_phi_tich_luy), 250_000_000, 'chi_phi=100M+150M');
    expect(Number(r.so_lan_sua)).toBe(2); // đúng 2 hồ sơ da_quyet còn sống
    near(Number(r.gttv), 800_000_000 + 250_000_000, 'gttv=800M+250M');
  });

  /* ── TC3: hợp đồng không-throw của assetXe ─────────────────────────────── */
  test('TC3 — assetXe id lạ/thiếu/sai kiểu → {ok:false,error:"404"}, KHÔNG throw', async () => {
    expect.assertions(4);
    const r1 = await assetXe(api, { id: 'XE-999999' });
    expect(r1).toEqual({ ok: false, error: '404' });
    const r2 = await assetXe(api, {});
    expect(r2.ok).toBe(false);
    const r3 = await assetXe(api, { id: 123 }); // type-confusion: number phải bị chặn sạch
    expect(r3.ok).toBe(false);
    const r4 = await assetXe(api, undefined); // args nullish cũng không được nổ
    expect(r4.ok).toBe(false);
  });

  /* ── TC4: edge nam_sx tương lai/NULL — không crash, gttv = nguyên giá + cp ─ */
  test('TC4 — edge: nam_sx tương lai/NULL → khấu hao 0, gttv = nguyên_gia + chi_phí; SC chưa da_quyet bỏ qua', async () => {
    const tuongLai = await mkXe('X4F', { namSx: YEAR + 5, nguyenGia: 1_000_000_000, isTest: 1 });
    const rF = await assetXe(api, { id: tuongLai });
    expect(rF.ok).toBe(true);
    expect(Number(rF.result.khau_hao_luy_ke)).toBe(0);
    near(Number(rF.result.gttv), 1_000_000_000, 'gttv xe tương lai');

    const nullSx = await mkXe('X4N', { namSx: null, nguyenGia: 1_000_000_000, isTest: 1 });
    await mkSc(nullSx, { trangThai: 'da_quyet', tong: 10_000_000 });
    await mkSc(nullSx, { trangThai: 'dang_sua', tong: 888_000_000 }); // chưa quyết toán → không tính
    const rN = await assetXe(api, { id: nullSx });
    expect(rN.ok).toBe(true);
    near(Number(rN.result.khau_hao_luy_ke), 0);
    near(Number(rN.result.chi_phi_tich_luy), 10_000_000);
    near(Number(rN.result.gttv), 1_010_000_000, 'gttv = 1 tỷ + cp 10M');
  });

  /* ── TC5: assetReport — lọc is_test=0, gttv giảm dần, tong + dem_xe nội bộ nhất quán ── */
  test('TC5 — assetReport: chỉ xe is_test=0, sắp gttv giảm, tong/dem_xe khớp items; xe is_test=1 KHÔNG xuất hiện', async () => {
    await db.query("DELETE FROM config WHERE key='khau_hao_nam'"); // khn mặc định 10
    // A: cao — 1 tỷ, 2 năm, quyết toán 250M → gttv 1,05 tỷ
    const xaA = await mkXe('X5A', { namSx: YEAR - 2, nguyenGia: 1_000_000_000, isTest: 0 });
    await mkSc(xaA, { trangThai: 'da_quyet', tong: 100_000_000 });
    await mkSc(xaA, { trangThai: 'da_quyet', tong: 150_000_000 });
    await mkSc(xaA, { trangThai: 'da_quyet', tong: 600_000_000, deleted: true }); // lọc deleted
    // B: thấp — 500M, 1 năm, chỉ có SC de_xuat → gttv 500M−50M=450M
    const xaB = await mkXe('X5B', { namSx: YEAR - 1, nguyenGia: 500_000_000, isTest: 0 });
    await mkSc(xaB, { trangThai: 'de_xuat', tong: 50_000_000 });
    // C: is_test=1 với gttv KHỦNG (2 tỷ) — chứng minh bộ lọc is_test=0 của report
    const xaC = await mkXe('X5C', { namSx: YEAR - 2, nguyenGia: 2_000_000_000, isTest: 1 });

    const res = await assetReport(api, {});
    expect(res.ok).toBe(true);
    const { items, tong } = res.result;
    expect(Array.isArray(items)).toBe(true);

    const ia = items.findIndex((i: any) => i.xe_id === xaA);
    const ib = items.findIndex((i: any) => i.xe_id === xaB);
    expect(ia).toBeGreaterThanOrEqual(0);
    expect(ib).toBeGreaterThanOrEqual(0);
    expect(ia).toBeLessThan(ib); // gttv GIẢM dần ⇒ A (1,05 tỷ) trước B (450M)
    // Số A-B vẫn phải đúng công thức ngay trong report (aggregate JOIN+GROUP BY)
    near(Number(items[ia].khau_hao_luy_ke), 200_000_000, 'report A khau_hao');
    near(Number(items[ia].chi_phi_tich_luy), 250_000_000, 'report A chi_phi');
    expect(Number(items[ia].so_lan_sua)).toBe(2);
    near(Number(items[ia].gttv), 1_050_000_000, 'report A gttv');
    near(Number(items[ib].gttv), 450_000_000, 'report B gttv');
    // is_test=1 không được lẫn vào sổ sách (kể cả gttv 2 tỷ)
    expect(items.some((i: any) => i.xe_id === xaC)).toBe(false);
    // Bất biến thứ tự + tổng nội bộ nhất quán trên TOÀN BỘ items (kể cả xe seed)
    for (let k = 1; k < items.length; k++)
      expect(items[k - 1].gttv).toBeGreaterThanOrEqual(items[k].gttv);
    expect(tong.dem_xe).toBe(items.length);
    near(Number(tong.tong_gttv), items.reduce((s: number, i: any) => s + Number(i.gttv), 0));
    near(Number(tong.tong_nguyen_gia), items.reduce((s: number, i: any) => s + Number(i.nguyen_gia), 0));
    near(Number(tong.tong_chi_phi), items.reduce((s: number, i: any) => s + Number(i.chi_phi_tich_luy), 0));
  });

  /* ── TC6: config khau_hao_nam override làm đổi số; giá trị rác → fallback 10 ── */
  test('TC6 — khau_hao_nam=5 → gttv 850M; giá trị 0/rác → guard fallback 10; xoá key → về 10', async () => {
    const xe = await mkXe('X6', { namSx: YEAR - 2, nguyenGia: 1_000_000_000, isTest: 1 });
    await mkSc(xe, { trangThai: 'da_quyet', tong: 250_000_000 });

    await db.query("INSERT INTO config(key,value) VALUES('khau_hao_nam','5') ON CONFLICT(key) DO UPDATE SET value='5'");
    expect(await getKhauHaoNam()).toBe(5);
    const r5 = await assetXe(api, { id: xe });
    near(Number(r5.result.khau_hao_luy_ke), 400_000_000, '5 năm/tỷ × 2 năm = 4e8');
    near(Number(r5.result.gttv), 600_000_000 + 250_000_000, 'gttv khn=5');

    await db.query("UPDATE config SET value='0' WHERE key='khau_hao_nam'"); // NaN/0 guard v3.6
    expect(await getKhauHaoNam()).toBe(10);
    await db.query("UPDATE config SET value='abc' WHERE key='khau_hao_nam'");
    expect(await getKhauHaoNam()).toBe(10);
    // Fallback về mặc định khi mất key đúng như configGet('khau_hao_nam', 10)
    await db.query("DELETE FROM config WHERE key='khau_hao_nam'");
    expect(await getKhauHaoNam()).toBe(10);
    const rBack = await assetXe(api, { id: xe });
    near(Number(rBack.result.gttv), 1_050_000_000, 'gttv khn=10 trở lại');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * W1.6f — assetXe/assetReport ĐÃ đăng ký trong lib/rpc.ts → test qua HTTP
 * /api/rpc + cookie sid (đường khách thật, pattern sc_totals + anon từ
 * kho_phieu2tang). Body = {ok:true, result:<handler-return>}; core asset tự
 * trả envelope {ok,result}/{ok,error} ⇒ UNWRAP HAI LỚP từ route.
 * ══════════════════════════════════════════════════════════════════════ */
jest.setTimeout(60000);

describe('W1.6f — asset qua RPC HTTP (đăng ký registry + RBAC + envelope)', () => {
  let xeRpc = '';

  beforeAll(async () => {
    // Ensure khn=10 regardless of any key left by earlier TC (idempotent).
    await db.query("DELETE FROM config WHERE key='khau_hao_nam'");
    // is_test=0 để xe XUẤT HIỆN trong assetReport (bộ lọc "xe hoạt động");
    // reuse mkXe/mkSc ⇒ createdXe/createdSc do afterAll cấp file dọn sẵn.
    xeRpc = await mkXe('XR', { namSx: YEAR - 2, nguyenGia: 1_000_000_000, isTest: 0 });
    await mkSc(xeRpc, { trangThai: 'da_quyet', tong: 250_000_000 });
  });

  test('T0 — registry: FN_LIST + META xe.xem + HANDLERS callable', () => {
    const reg = getRegistry();
    expect(reg.FN_LIST).toContain('assetXe');
    expect(reg.FN_LIST).toContain('assetReport');
    expect(reg.META['assetXe']).toEqual(['xe', 'xem']);
    expect(reg.META['assetReport']).toEqual(['xe', 'xem']);
    expect(typeof reg.HANDLERS['assetXe']).toBe('function');
    expect(typeof reg.HANDLERS['assetReport']).toBe('function');
    expect(reg.OPEN.has('assetXe')).toBe(false); // không OPEN ⇒ thiếu cookie phải 401
  });

  test('T1 — giamdoc assetXe {id} → 200, envelope ok:true, số khau_hao/chi_phi/gttv đúng v3.6', async () => {
    const res = await rpc(getGiamdocToken(), 'assetXe', { id: xeRpc });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const payload = res.body.result; // envelope của handler
    expect(payload.ok).toBe(true);
    const r = payload.result;
    expect(r.xe_id).toBe(xeRpc);
    near(Number(r.khau_hao_luy_ke), 200_000_000, 'http khau_hao');
    near(Number(r.chi_phi_tich_luy), 250_000_000, 'http chi_phi');
    expect(Number(r.so_lan_sua)).toBe(1);
    near(Number(r.gttv), 1_050_000_000, 'http gttv');
  });

  test('T2 — ketoan assetXe cho cùng gttv (mọi role có xe.xem đi được như nhau)', async () => {
    const res = await rpc(getKetoanToken(), 'assetXe', { id: xeRpc });
    expect(res.status).toBe(200);
    expect(res.body.result.ok).toBe(true);
    near(Number(res.body.result.result.gttv), 1_050_000_000, 'ketoan gttv');
  });

  test('T3 — assetReport {} → items≥1, fixture XR có mặt, tong.dem_xe === items.length', async () => {
    const res = await rpc(getGiamdocToken(), 'assetReport');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const payload = res.body.result;
    expect(payload.ok).toBe(true);
    const { items, tong } = payload.result;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const i = items.findIndex((x: any) => x.xe_id === xeRpc);
    expect(i).toBeGreaterThanOrEqual(0);
    near(Number(items[i].gttv), 1_050_000_000, 'report gttv fixture');
    expect(tong.dem_xe).toBe(items.length);
  });

  test('T4 — anon (không cookie) cả 2 fn → HTTP 401 (fail-closed, không tới handler)', async () => {
    const a = await anon('assetXe', { id: xeRpc });
    expect(a.status).toBe(401);
    expect(a.body.ok).toBe(false);
    const b = await anon('assetReport');
    expect(b.status).toBe(401);
  });

  test('T5 — id không tồn tại → handler {ok:false,error:"404"} trong envelope, KHÔNG nổ HTTP', async () => {
    const res = await rpc(getGiamdocToken(), 'assetXe', { id: 'XE-999999' });
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ ok: false, error: '404' });
  });
});
