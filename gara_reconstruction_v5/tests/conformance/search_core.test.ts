/**
 * W4.2 — search_core.test.ts · globalSearch (lib/core/search.ts) — core TRỰC TIẾP.
 *
 * fn CHƯA đăng ký lib/rpc.ts (đợt reg gộp W4 — coordinator), nên test không qua
 * HTTP: buildApi + gọi thẳng hàm core, kế thừa pattern kho_tonkho.test.ts /
 * kho_cuhong.test.ts (cùng tình huống "core trước, reg sau"; lib/api.ts buildApi
 * — không token, không supertest).
 *
 * Yêu cầu W4.2 được kiểm:
 *  (T1) khớp KHÔNG phân biệt HOA/thường — ILIKE UTF-8 (v5 siết thay upper() LIKE
 *       của v4); đủ 5 đường: sc theo mã (id), sc theo BIỂN SỐ qua JOIN xe,
 *       xe.bien_so, dm.id, vattu.ten.
 *  (T2) literal chứa ký tự wildcard `'%;)'` KHÔNG crash + hiểu NGUYÊN VĂN
 *       (escape [%_\] + ESCAPE '\' — v4 thiếu bước này; nếu escape hỏng, pattern
 *       '%W42 %;)%' thành wildcard khớp MỌI tên 'W42 …' → đếm dòng phát hiện).
 *       Kèm chuỗi injection kinh điển — không nổ, bảng còn nguyên.
 *  (T3) q '' / khoảng trắng / thiếu / 1 ký tự → {ok:false,'q tối thiểu 2…'};
 *       chưa đăng nhập → {ok:false,'Chưa đăng nhập.'} (v4 throw → v5 envelope,
 *       quy ước hàm mới W1b+ như tonKho — KHÔNG throw cho business error).
 *  (T4) soft-delete ẩn (deleted_at='' — vattu + sc xóa mềm không về kết quả).
 *  (T5) envelope {ok:true,result:{sc,xe,dm,vattu}} đủ 4 mảng; limit rác → mặc
 *       định 10; limit 999 → clamp ≤30.
 *  (T6) is_test phân vai theo pattern scList: fixture admin (is_test=1) ẩn với
 *       xuong — CẢ 2 cửa: dòng xe riêng lẫn bien_so của nó lọt qua JOIN sc;
 *       admin thấy đủ.
 *  (T7) escapeLike thuần (không DB).
 *
 * ma trận quyền v5 (lib/perm.ts): xe.tao CHỈ admin → fixture xe luôn is_test=1
 * → các assert "xuong thấy fixture" dùng dòng non-test do xuong/kho tạo
 * (sc/vattu/dm); assert xe đi qua admin. MARK 'W42' tách với seed + suite song
 * song trên DB shared (globalSetup về schema sạch mỗi lệnh jest).
 */
import { buildApi } from '../../lib/api';
import { db } from '../../lib/db';
import { globalSearch, escapeLike } from '../../lib/core/search';
import { xeCreate } from '../../lib/core/xe';
import { scCreate } from '../../lib/core/sc';
import { vattuCreate, dmCreate } from '../../lib/core/kho';
// W4-reg — phần HTTP /api/rpc cuối file (fn đã vào registry): supertest +
// token harness (setup.ts mint, clear must_change) + đọc registry đối chiếu.
import request from 'supertest';
import { getTokens } from './setup';
import { getRegistry } from '../../lib/rpc';

const apiXuong = buildApi({ id: 'U-XUONG', name: 'xuong', role: 'xuong' });
const apiAdmin = buildApi({ id: 'U-ADMIN', name: 'admin', role: 'admin' });
const apiKho = buildApi({ id: 'U-KHO', name: 'kho', role: 'kho' });
const apiAnon = buildApi(null); // chưa đăng nhập

const today = () => new Date().toISOString().split('T')[0];
const MARK = 'W42';

// ids fixture để dạy (soft-delete — quy tắc v5 không DELETE cứng)
const xeIds: string[] = [];
const scIds: string[] = [];
const vtIds: string[] = [];
const dmIds: string[] = [];

jest.setTimeout(60000);

afterAll(async () => {
  if (dmIds.length) await db.query('UPDATE dm SET deleted_at = $1 WHERE id = ANY($2::text[])', [today(), dmIds]);
  if (vtIds.length) await db.query('UPDATE vattu SET deleted_at = $1 WHERE id = ANY($2::text[])', [today(), vtIds]);
  if (scIds.length) await db.query('UPDATE sc SET deleted_at = $1 WHERE id = ANY($2::text[])', [today(), scIds]);
  if (xeIds.length) await db.query('UPDATE xe SET deleted_at = $1 WHERE id = ANY($2::text[])', [today(), xeIds]);
});

describe('W4.2 — globalSearch core (ILIKE + escape wildcard, envelope, is_test/soft-delete v5)', () => {
  // fixture — dựng một lần cho cả suite
  let xeId = ''; // xe ADMIN tạo → is_test=1 (xe.tao chỉ admin có trong MATRIX)
  const bienSo = `${MARK}29X1`;
  const vtTenSong = `${MARK} Lốp TRÒN`; // kho tạo → is_test=0
  const vtTenPct = `${MARK} %;) vòng bi`; // mồi escape — literal bám ngay sau MARK
  const vtTenXoa = `${MARK} da-xoa-ten`; // xóa mềm
  const vtTenAdmin = `${MARK} admin-test`; // is_test=1 của admin
  let scId = ''; // phiếu xuong tạo → is_test=0, gắn xe test
  let scIdXoa = ''; // đã xóa mềm
  let dmId = ''; // DM của kho → is_test=0

  beforeAll(async () => {
    const xe = await xeCreate(apiAdmin, { bien_so: bienSo, chu_xe: 'W42 chủ A' });
    xeId = xe.id;
    xeIds.push(xe.id);

    const sc = await scCreate(apiXuong, { xe_id: xeId, ngay: today() });
    scId = sc.id;
    scIds.push(sc.id);

    const vt = await vattuCreate(apiKho, { ten: vtTenSong, don_vi: 'cái', ton_min: 0 });
    vtIds.push(vt.id);
    const vtPct = await vattuCreate(apiKho, { ten: vtTenPct, don_vi: 'viên', ton_min: 0 });
    vtIds.push(vtPct.id);
    const vtXoa = await vattuCreate(apiKho, { ten: vtTenXoa, don_vi: 'cái', ton_min: 0 });
    vtIds.push(vtXoa.id);
    await db.query('UPDATE vattu SET deleted_at = $1 WHERE id = $2', [today(), vtXoa.id]);

    const scXoa = await scCreate(apiXuong, { xe_id: xeId, ngay: today() });
    scIdXoa = scXoa.id;
    scIds.push(scXoa.id);
    await db.query('UPDATE sc SET deleted_at = $1 WHERE id = $2', [today(), scXoa.id]);

    const vtAdm = await vattuCreate(apiAdmin, { ten: vtTenAdmin, don_vi: 'cái', ton_min: 0 });
    vtIds.push(vtAdm.id);

    const dm = await dmCreate(apiKho, { sc_id: scId, items: [{ vattu_id: vt.id, so_luong: 1, don_gia: 100 }], ngay: today() });
    dmId = dm.id;
    dmIds.push(dm.id);
  });

  /** assert khuôn W1b+: envelope ok + 4 mảng result. */
  function expectShape(r: Awaited<ReturnType<typeof globalSearch>>) {
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Array.isArray(r.result.sc)).toBe(true);
      expect(Array.isArray(r.result.xe)).toBe(true);
      expect(Array.isArray(r.result.dm)).toBe(true);
      expect(Array.isArray(r.result.vattu)).toBe(true);
      return r.result;
    }
    throw new Error('envelope ok:false bất ngờ: ' + r.error);
  }

  /* ═══ T3 — chặn input sớm (envelope, không throw) ═══ */
  test('T3 — q rỗng/khoảng trắng/thiếu/1 ký tự → {ok:false,"q tối thiểu 2"}; ẩn danh → Chưa đăng nhập', async () => {
    for (const c of [{ q: '' }, { q: '   ' }, {} as Record<string, unknown>, { q: 'a' }, { q: 1 }]) {
      const r = await globalSearch(apiXuong, c);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('q tối thiểu 2');
    }
    const anon = await globalSearch(apiAnon, { q: MARK });
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.error).toContain('Chưa đăng nhập');
  });

  /* ═══ T1 — không phân biệt HOA/thường, cả 5 đường khớp (admin thấy hết fixture) ═══ */
  test('T1 — ILIKE chữ THƯỜNG vẫn khớp fixture in HOA: sc theo mã, sc theo biển số (JOIN), xe, dm, vattu', async () => {
    const r = expectShape(await globalSearch(apiAdmin, { q: MARK.toLowerCase(), limit: 30 }));
    // xe + sc-qua-bien_so (fixture in hoa W4229X1 khớp 'w42' thường 2 chiều)
    expect(r.xe.map((x) => x.bien_so)).toContain(bienSo);
    expect(r.sc.map((s) => s.ma)).toContain(scId);
    expect(r.sc.find((s) => s.ma === scId)!.bien_so).toBe(bienSo);
    // vattu theo tên (mồi %;) cũng về vì chứa W42 hoa
    expect(r.vattu.map((v) => v.ten)).toContain(vtTenSong);
    // chiều ngược: IN HOA khớp dòng tên thường ('da-xoa' đã xóa mềm → biến mất, T4)
    const hoa = expectShape(await globalSearch(apiAdmin, { q: bienSo }));
    expect(hoa.xe.map((x) => x.bien_so)).toContain(bienSo);
    // dm.id theo đườngRIÊng — id hệ thống DM-xxxx không chứa MARK
    const theoDm = expectShape(await globalSearch(apiAdmin, { q: dmId.toLowerCase() }));
    expect(theoDm.dm.map((d) => d.id)).toContain(dmId);
  });

  /* ═══ T2 — literal '%;)' nguyên văn (không escape sẽ thành wildcard khớp hết) ═══ */
  test('T2 — "%;)" không crash, khớp đúng dòng chứa literal; "MARK %;)" tách dòng thường; injection để nguyên bảng', async () => {
    const alone = expectShape(await globalSearch(apiXuong, { q: '%;)' }));
    expect(alone.vattu).toHaveLength(1); // CHỈ mồi '… %;)' — không phải mọi dòng
    expect(alone.vattu[0].ten).toBe(vtTenPct);

    // LƯỚI CHẶN REGRESSION: nếu escapeLike bị bỏ, pattern nội suy thành
    // '%W42 %;)%' → wildcard khớp CẢ 'W42 Lốp TRÒN' (2 dòng). 1 dòng = escape sống.
    const combo = expectShape(await globalSearch(apiXuong, { q: `${MARK} %;)` }));
    expect(combo.vattu).toHaveLength(1);

    // injection kinh điển: không nổ, không khớp, cấu trúc trả về nguyên vẹn
    const inj = expectShape(await globalSearch(apiXuong, { q: "'; DROP TABLE vattu;--" }));
    expect(inj.vattu).toHaveLength(0);
    const song = await db.query('SELECT COUNT(*)::int AS c FROM vattu WHERE id = $1', [vtIds[0]]);
    expect(song.rows[0].c).toBe(1);
  });

  /* ═══ T4 — soft-delete ẩn ═══ */
  test('T4 — dòng deleted_at≠"": vattu xóa mềm không tên; sc xóa mềm không ma (kể cả đường JOIN biển số)', async () => {
    const vt = expectShape(await globalSearch(apiAdmin, { q: `${MARK} da-xoa`, limit: 30 }));
    expect(vt.vattu).toHaveLength(0);
    // cả hai sc fixture cùng gắn xe bien_so test: admin đường JOIN trả duy nhất dòng SỐNG
    const sc = expectShape(await globalSearch(apiAdmin, { q: bienSo, limit: 30 }));
    expect(sc.sc.map((s) => s.ma)).toContain(scId);
    expect(sc.sc.map((s) => s.ma)).not.toContain(scIdXoa);
  });

  /* ═══ T5 — khuôn kết quả + limit clamp ═══ */
  test('T5 — {ok,result:{sc,xe,dm,vattu}}; limit rác→≤10 (mặc định), 999→≤30 (clamp), không nổ', async () => {
    const dem = (r: ReturnType<typeof expectShape>) =>
      (['sc', 'xe', 'dm', 'vattu'] as const).every((k) => r[k].length <= 10 && r[k].length >= 0);
    expect(dem(expectShape(await globalSearch(apiAdmin, { q: MARK })))).toBe(true);
    const big = expectShape(await globalSearch(apiAdmin, { q: MARK, limit: 999 }));
    for (const k of ['sc', 'xe', 'dm', 'vattu'] as const) expect(big[k].length).toBeLessThanOrEqual(30);
    expect((await globalSearch(apiAdmin, { q: MARK, limit: 'abc' })).ok).toBe(true);
    expect((await globalSearch(apiAdmin, { q: MARK, limit: 0 })).ok).toBe(true);
  });

  /* ═══ T6 — is_test phân vai (pattern scList) + không rò biển số xe test qua JOIN cho role thường ═══ */
  test('T6 — fixture is_test=1 (admin): xuong KHÔNG thấy xe riêng lẫn sc-qua-bien-so; admin thấy', async () => {
    const q = bienSo.toLowerCase();
    const thuong = expectShape(await globalSearch(apiXuong, { q, limit: 30 }));
    expect(thuong.xe.map((x) => x.bien_so)).not.toContain(bienSo);
    // JOIN-LEAK CHECK: sc của xuong (is_test=0) gắn xe test — đường khớp BIỂN SỐ
    // phải TẮT với role thường (xe ẩn → bien_so null), không lộ biển test.
    expect(thuong.sc.map((s) => s.ma)).not.toContain(scId);

    const ad = expectShape(await globalSearch(apiAdmin, { q, limit: 30 }));
    expect(ad.xe.map((x) => x.bien_so)).toContain(bienSo);
    expect(ad.sc.map((s) => s.ma)).toContain(scId);

    // vattu is_test=1: xuong không thấy, admin thấy
    const vtT = expectShape(await globalSearch(apiXuong, { q: `${MARK} admin-test` }));
    expect(vtT.vattu).toHaveLength(0);
    const vtA = expectShape(await globalSearch(apiAdmin, { q: `${MARK} admin-test` }));
    expect(vtA.vattu.map((v) => v.ten)).toContain(vtTenAdmin);

    // role thường VẪN thấy dòng is_test=0 qua mã phiếu (đường id không phụ thuộc xe)
    const scMay = expectShape(await globalSearch(apiXuong, { q: scId.toLowerCase() }));
    expect(scMay.sc.map((s) => s.ma)).toContain(scId);
    expect(scMay.sc[0].bien_so).toBeNull(); // biển xe test không rò
  });

  /* ═══ T7 — escapeLike thuần ═══ */
  test('T7 — escapeLike: wildcard %_ và backslash được escape; text thường giữ nguyên', () => {
    expect(escapeLike('abc')).toBe('abc');
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('_%\\')).toBe('\\_\\%\\\\');
  });
});

/* ═══ W4-REG — fn ĐÃ vào lib/rpc.ts: cùng hành vi QUA HTTP /api/rpc ═══
 * search.ts:27 ghi "khi reg META dự kiến ['sc','xem']" — W4-reg chốt ĐÚNG giá
 * trị đó. Các test dưới đi qua DISPATCH + ROUTE theo contract client
 * POST /api/rpc {fn,args} → route bọc {ok:true, result:<envelope lõi>} —
 * UI GlobalSearch.tsx:100 unwrap đúng 2 tầng này. Args giữ khuôn v4: {q}. */
describe('W4-reg — globalSearch qua HTTP /api/rpc (registry + envelope 2 tầng)', () => {
  const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const rpcHttp = (token: string | null, fn: string, args: any = {}) => {
    const r = request(BASE).post('/api/rpc').send({ fn, args });
    return token ? r.set('Cookie', [`sid=${token}`]) : r;
  };

  test('registry: globalSearch ∈ FN_LIST, không OPEN, META = ["sc","xem"] (đúng dự kiến search.ts header)', () => {
    const { FN_LIST, META, OPEN } = getRegistry();
    expect(FN_LIST).toContain('globalSearch');
    expect(OPEN.has('globalSearch')).toBe(false);
    expect(META.globalSearch).toEqual(['sc', 'xem']);
  });

  test('ẩn danh → 401 tại DISPATCH (fn không OPEN; lõi "Chưa đăng nhập." chỉ còn đường gọi trực tiếp/MCP)', async () => {
    const res = await rpcHttp(null, 'globalSearch', { q: 'SC-' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('mọi role có sc.xem (xuong/kho/ketoan/giamdoc/admin) → 200 + envelope lõi đủ 4 nhóm', async () => {
    for (const role of ['xuong', 'kho', 'ketoan', 'giamdoc', 'admin'] as const) {
      const token = getTokens()[role];
      expect(token).toBeTruthy(); // token thiếu = harness bug → fail toàn bộ khối này
      const res = await rpcHttp(token, 'globalSearch', { q: 'SC-', limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const env = res.body.result as any; // tầng 1 — route wrap
      expect(env.ok).toBe(true);          // tầng 2 — envelope search.ts
      for (const k of ['sc', 'xe', 'dm', 'vattu']) expect(Array.isArray(env.result[k])).toBe(true);
    }
  });

  test('q cụt/blank → 200 + envelope {ok:false,"q tối thiểu 2"} — KHÔNG thành HTTP 4xx (khuôn W1b+ giữ nguyên khi reg)', async () => {
    const res = await rpcHttp(getTokens().xuong, 'globalSearch', { q: ' a ' });
    expect(res.status).toBe(200);
    expect((res.body.result as any).ok).toBe(false);
    expect((res.body.result as any).error).toContain('q tối thiểu 2');
  });
});
