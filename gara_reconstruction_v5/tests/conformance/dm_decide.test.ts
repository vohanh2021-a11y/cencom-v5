/**
 * dm_decide.test.ts — W2b CHUỖI DUYỆT DM: dmDecide + dmFromSC + dmAutoBu
 * (PLAN WAVE 2.2+2.3+2.4; port v3.6 kho.js dmDecide/dmFromSC/dmAutoBu +
 * perm.js canApproveMua/duyet_mua_nguong — seed v3.6 = 5.000.000đ).
 *
 * Kiểm chứng theo schema v5 THẬT sau ALTER (db/schema.sql):
 *  - CHECK `dm.trang_thai` nhận 'da_duyet'; cột mới nguoi_duyet/ngay_duyet/ly_do.
 *  - dmDecide: tx + FOR UPDATE; gate RPC ['kho','xem'] + quyền NGUYÊN v3.6
 *    trong core: admin/giamdoc vô hạn, ketoan ≤ ngưỡng duyet_mua_nguong,
 *    role khác bị từ chối với message chứa 'Giám đốc'; tu_choi bắt buộc
 *    ly_do; quyết định lại trên DM đã xử lý → 'chỉ duyệt khi chờ duyệt'.
 *  - dmFromSC: gom sc_vattu can_mua theo vattu (SUM), đơn giá = gd_dk dòng ĐẦU
 *    (0 → giá vật tư), 1 DM 1 dòng per-vattu, EXISTS open → 'đang mở',
 *    DM xóa mềm không chặn nữa, audit dm_tao ly_do='Vật tư cho phiếu sửa chữa'.
 *  - dmAutoBu: bù (ton_min − ton) cho VT thiếu; BỎ VT đã có DM mở
 *    (cho_duyet LẪN da_duyet — đúng tập v3.6); 1 DM nhiều dòng không sc_id;
 *    không thiếu → id:null 'Không cần bổ sung tồn.'; audit mo_ta chứa ly_do.
 *  - Ngưỡng default: core TỰ INSERT missing key = 5000000 (đúng số v3.6 seed).
 *  - Regress guard W2a: dmDelete chỉ cho 'cho_duyet' (thử trên da_duyet + tu_choi).
 *  - W2c (test (7)): dmNhap CHỈ nhập DM 'da_duyet' — cho_duyet/tu_choi/da_nhap
 *    đều chặn bằng envelope 'Chỉ nhập khi đề nghị đã duyệt.' (v3.6 phNhapCreate
 *    :341-343); xuong chết ở gate kho.tao (403); sau giamdoc duyet → nhập OK,
 *    ton tăng đúng; dmDetail expose nguoi_duyet/ngay_duyet/ly_do.
 *
 * CONFIG RESTORE: ngưỡng chỉ nâng/hạ trong test (2) qua db TRỰC TIẾP, restore
 * nguyên trạng ở finally + afterAll; test (5) chạy SAU (2) nên ngưỡng đã về default.
 *
 * HTTP /api/rpc + cookie sid — pattern thừa kế dm_read.test.ts; server :3000
 * spawn sẵn theo scripts/test-conformance.mjs; globalSetup DROP/CREATE+seed.
 */
import request from 'supertest';
import { getAdminToken, getKhoToken, getGiamdocToken, getKetoanToken, getXuongToken } from './setup';
import { db, nextId } from '../../lib/db';
import { getRegistry } from '../../lib/rpc';
import { RPC_SCHEMAS } from '../../lib/contracts';
import { PART4 } from '../../mcp-server/tool-docs.part4';
import { isWriteAllowed } from '../../mcp-server/auth';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });
const anon = (fn: string, args: any = {}) => request(BASE).post('/api/rpc').send({ fn, args });

const today = () => new Date().toISOString().split('T')[0];

/** body = {ok:true,result:<envelope core>}; hàm W2b LUÔN envelope {ok,...}. */
async function callOk(res: any, fn: string) {
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  const payload = res.body.result;
  expect(payload && typeof payload.ok === 'boolean').toBe(true);
  return payload as any;
}

jest.setTimeout(90000);

describe('W2b DM duyệt — dmDecide/dmFromSC/dmAutoBu (port v3.6)', () => {
  let scId: string;
  let vtP1 = ''; // gia 100 — DM lớn 5×100 = 500
  let vtP2 = ''; // gia 10  — DM nhỏ 5×10  = 50
  let vtA = '';  // gia 250 — phục vụ dmFromSC
  const NGUONG_KEY = 'duyet_mua_nguong';
  let nguongBefore: { exists: boolean; value: string } = { exists: false, value: '' };

  beforeAll(async () => {
    const xe = await db.query("SELECT id FROM xe WHERE deleted_at = '' ORDER BY id LIMIT 1");
    expect(xe.rows.length).toBeGreaterThan(0);
    const scRes = await rpc(getAdminToken(), 'scCreate', { xe_id: xe.rows[0].id, ngay: today() });
    expect(scRes.body.ok).toBe(true);
    scId = scRes.body.result.id;

    const giaBy: Array<[string, number]> = [['W2b VT 100đ', 100], ['W2b VT 10đ', 10], ['W2b VT 250đ', 250]];
    const ids: string[] = [];
    for (const [ten, gia] of giaBy) {
      const r = await rpc(getKhoToken(), 'vattuCreate', { ten, don_vi: 'cái', gia, ton_min: 0 });
      expect(r.body.ok).toBe(true);
      ids.push(r.body.result.id as string);
    }
    [vtP1, vtP2, vtA] = ids;

    const cfg = await db.query('SELECT value FROM config WHERE key = $1', [NGUONG_KEY]);
    nguongBefore = cfg.rows.length
      ? { exists: true, value: String(cfg.rows[0].value) }
      : { exists: false, value: '' };
  });

  afterAll(async () => {
    // restore nguyên trạng config ngưỡng (DB chung swarm — không để lại 100đ)
    if (nguongBefore.exists) {
      await db.query('UPDATE config SET value = $1 WHERE key = $2', [nguongBefore.value, NGUONG_KEY]);
    } else {
      await db.query('DELETE FROM config WHERE key = $1', [NGUONG_KEY]);
    }
  });

  const mkDm = async (vattuId: string, sl: number, gia: number): Promise<string> => {
    const r = await rpc(getKhoToken(), 'dmCreate', {
      ngay: today(), items: [{ vattu_id: vattuId, so_luong: sl, don_gia: gia }],
    });
    expect(r.body.ok).toBe(true);
    return r.body.result.id as string;
  };

  test('(0) registry: 3 fn mới có FN_LIST/META/contracts/docs WRITE; MCP deny mặc định', () => {
    const reg = getRegistry();
    for (const fn of ['dmDecide', 'dmFromSC', 'dmAutoBu']) {
      expect(reg.FN_LIST).toContain(fn);
      expect(reg.OPEN.has(fn)).toBe(false);
      expect(reg.META[fn]).toBeDefined();
      expect(RPC_SCHEMAS[fn]).toBeDefined();
      expect(PART4[fn]).toBeDefined();
      expect(PART4[fn].mode).toBe('WRITE');
      // READ_TOOLS không thêm (W2b chốt) → MCP mode='' chặn cả 3
      expect(isWriteAllowed(fn)).toBe(false);
    }
    expect(reg.META.dmDecide).toEqual(['kho', 'xem']); // gate rộng; quyền thật ở core
    expect(reg.META.dmFromSC).toEqual(['kho', 'tao']);
    expect(reg.META.dmAutoBu).toEqual(['kho', 'tao']);
    // fn READ cũ vẫn mở cho MCP
    expect(isWriteAllowed('dmList')).toBe(true);
  });

  test('(1) schema v5: CHECK nhận da_duyet + cột nguoi_duyet/ngay_duyet/ly_do', async () => {
    const id = 'DM-W2BCHECK';
    await db.query(
      "INSERT INTO dm (id, sc_id, trang_thai, tong, nguoi_tao, ngay_tao, nguoi_duyet, ngay_duyet, ly_do, is_test) " +
      "VALUES ($1, NULL, 'da_duyet', 0, NULL, $2, 'US-X', '2026-09-01', 'check', 1)",
      [id, today()]
    );
    const det = await callOk(await rpc(getKhoToken(), 'dmDetail', { id }), 'dmDetail');
    expect(det.ok).toBe(true);
    expect(det.dm.trang_thai).toBe('da_duyet'); // shape dmDetail W2a không đổi → không vỡ
    const rowChk = await db.query(
      'SELECT nguoi_duyet, ngay_duyet, ly_do FROM dm WHERE id = $1', [id]
    );
    expect(rowChk.rows[0]).toMatchObject({ nguoi_duyet: 'US-X', ngay_duyet: '2026-09-01', ly_do: 'check' });
    await db.query('DELETE FROM dm WHERE id = $1', [id]);
  });

  test('(2) ngưỡng duyet_mua_nguong: default 5.000.000 (số v3.6) + gọi sai quyền → Giám đốc; ketoan trong ngưỡng OK; giamdoc trên ngưỡng OK', async () => {
    const dmBig = await mkDm(vtP1, 5, 100); // tong 500

    // Lần quyết định ĐẦU TIÊN phải TỰ seed key = số default v3.6 seed.js:260
    const first = await callOk(await rpc(getKhoToken(), 'dmDecide', { id: dmBig, quyet: 'duyet' }), 'dmDecide');
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/Giám đốc/); // role kho ngoài tập duyệt v3.6 (khoa v3.6 không mua.duy)
    const seeded = await db.query('SELECT value FROM config WHERE key = $1', [NGUONG_KEY]);
    expect(seeded.rows.length).toBe(1);
    expect(Number(seeded.rows[0].value)).toBe(5000000);

    // hạ ngưỡng = 100 TRỰC TIẾP qua db (hợp đồng test W2b)
    await db.query('UPDATE config SET value = $1 WHERE key = $2', ['100', NGUONG_KEY]);
    try {
      // ketoan trên ngưỡng → chặn, messagepattern v3.6
      const ke = await callOk(await rpc(getKetoanToken(), 'dmDecide', { id: dmBig, quyet: 'duyet' }), 'dmDecide');
      expect(ke.ok).toBe(false);
      expect(ke.error).toMatch(/Giám đốc/);
      expect(ke.error).toMatch(/ngưỡng/);
      // DM chưa bị đổi trạng thái bởi lệnh thất bại
      const chk = await db.query('SELECT trang_thai FROM dm WHERE id = $1', [dmBig]);
      expect(chk.rows[0].trang_thai).toBe('cho_duyet');

      // ketoan TRONG ngưỡng → duyệt được (hành vi v3.6)
      const dmSmall = await mkDm(vtP2, 5, 10); // tong 50 ≤ 100
      const keOk = await callOk(await rpc(getKetoanToken(), 'dmDecide', { id: dmSmall, quyet: 'duyet' }), 'dmDecide');
      expect(keOk.ok).toBe(true);
      expect(keOk.trang_thai).toBe('da_duyet');

      // giamdoc trên ngưỡng → OK + ghi người/ngày duyệt (v3.6: meId + db.today)
      const gd = await callOk(await rpc(getGiamdocToken(), 'dmDecide', { id: dmBig, quyet: 'duyet' }), 'dmDecide');
      expect(gd.ok).toBe(true);
      expect(gd.trang_thai).toBe('da_duyet');
      const row = await db.query(
        "SELECT trang_thai, nguoi_duyet, ngay_duyet, ly_do FROM dm WHERE id = $1", [dmBig]
      );
      expect(row.rows[0].trang_thai).toBe('da_duyet');
      expect(String(row.rows[0].nguoi_duyet).length).toBeGreaterThan(0);
      expect(row.rows[0].ngay_duyet).toBe(today());
      expect(row.rows[0].ly_do).toBe(''); // duyệt KHÔNG ghi lý do (nguyên v3.6)

      // audit dm_duyet nằm lại DB (tx commit)
      const aud = await db.query(
        "SELECT hanh_dong, mo_ta FROM activity_log WHERE hanh_dong = 'dm_duyet' AND doi_tuong_id = $1 ORDER BY id DESC LIMIT 1",
        [dmBig]
      );
      expect(aud.rows.length).toBe(1);
      expect(aud.rows[0].mo_ta).toMatch(/Duyệt/);
    } finally {
      if (nguongBefore.exists) {
        await db.query('UPDATE config SET value = $1 WHERE key = $2', [nguongBefore.value, NGUONG_KEY]);
      } else {
        await db.query('DELETE FROM config WHERE key = $1', [NGUONG_KEY]);
      }
    }
  });

  test('(3) tu_choi: thiếu lý do → lỗi; đủ → tu_choi + ghi ly_do; quyết định lại → chỉ duyệt khi chờ duyệt', async () => {
    const dm3 = await mkDm(vtP2, 5, 10); // tong 50, ngưỡng mặc định 5tr — ketoan OK
    const noWhy = await callOk(await rpc(getKetoanToken(), 'dmDecide', { id: dm3, quyet: 'tu_choi' }), 'dmDecide');
    expect(noWhy.ok).toBe(false);
    expect(noWhy.error).toMatch(/lý do/i);

    const why = 'Không phù hợp ngân sách quý';
    const rej = await callOk(await rpc(getKetoanToken(), 'dmDecide', { id: dm3, quyet: 'tu_choi', ly_do: why }), 'dmDecide');
    expect(rej.ok).toBe(true);
    expect(rej.trang_thai).toBe('tu_choi');
    const row = await db.query('SELECT trang_thai, ly_do, nguoi_duyet FROM dm WHERE id = $1', [dm3]);
    expect(row.rows[0].trang_thai).toBe('tu_choi');
    expect(row.rows[0].ly_do).toBe(why);
    expect(row.rows[0].nguoi_duyet).toBe(''); // v3.6: từ chối không ghi người duyệt

    // mọi lần decide sau đó trên DM đã xử lý → chặn trạng thái (cả role đủ quyền)
    for (const tok of [getKetoanToken(), getGiamdocToken()]) {
      const again = await callOk(await rpc(tok, 'dmDecide', { id: dm3, quyet: 'duyet' }), 'dmDecide');
      expect(again.ok).toBe(false);
      expect(again.error).toMatch(/chỉ duyệt khi chờ duyệt/i);
    }

    // regress guard W2a: dmDelete từ chối cả tu_choi lẫn da_duyet
    const delRej = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: dm3 }), 'dmDelete');
    expect(delRej.ok).toBe(false);
    expect(delRej.error).toMatch(/chờ duyệt/);
    const daDuyetId = await mkDm(vtP2, 1, 10);
    await rpc(getGiamdocToken(), 'dmDecide', { id: daDuyetId, quyet: 'duyet' });
    const delOk = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: daDuyetId }), 'dmDelete');
    expect(delOk.ok).toBe(false);
    expect(delOk.error).toMatch(/chờ duyệt/);
  });

  test('(4) dmFromSC: gom 2 dòng cùng VT → 1 dòng tong đúng; lặp → đang mở; xóa mềm → tạo lại; guard da_duyet', async () => {
    // cầu SC: 2 dòng sc_vattu CÙNG vattu (4 + 6 = 10), gd_dk dòng đầu 300, dòng sau 999
    const add = await rpc(getAdminToken(), 'scAddVatTu', { sc_id: scId, vattu_id: vtA, so_luong: 4 });
    expect(add.body.ok).toBe(true);
    const r1 = add.body.result.id as string;
    const id2 = await nextId('VT');
    await db.query(
      "INSERT INTO sc_vattu (id, sc_id, vattu_id, so_luong, gd_dk, tt) VALUES ($1,$2,$3,6,999,'can_mua')",
      [id2, scId, vtA]
    );
    await db.query('UPDATE sc_vattu SET gd_dk = 300 WHERE id = $1', [r1]);

    const out = await callOk(await rpc(getKhoToken(), 'dmFromSC', { sc_id: scId }), 'dmFromSC');
    expect(out.ok).toBe(true);
    expect(out.id).toMatch(/^DM-\d{6}$/);
    expect(out.so_dong).toBe(1);            // GROUP đúng 1 dòng
    expect(out.tong).toBe(3000);            // 10 × 300 (gd_dk DÒNG ĐẦU — v3.6 first-seen)
    const det = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: out.id }), 'dmDetail');
    expect(det.items).toHaveLength(1);
    expect(Number(det.items[0].so_luong)).toBe(10);
    expect(Number(det.items[0].don_gia)).toBe(300);
    expect(det.dm.sc_id).toBe(scId);
    const hdr = await db.query('SELECT sc_id, ly_do FROM dm WHERE id = $1', [out.id]);
    expect(hdr.rows[0].ly_do).toBe('Vật tư cho phiếu sửa chữa ' + scId); // v3.6 ghi_chu nguyên văn
    const aud = await db.query(
      "SELECT mo_ta FROM activity_log WHERE hanh_dong='dm_tao' AND doi_tuong_id=$1", [out.id]
    );
    expect(aud.rows[0].mo_ta).toMatch(/Vật tư cho phiếu sửa chữa/);

    // lặp → 'đang mở' (kèm id DM mở — v3.6 pattern 'Đã có đề nghị mua: <id>')
    const dup = await callOk(await rpc(getKhoToken(), 'dmFromSC', { sc_id: scId }), 'dmFromSC');
    expect(dup.ok).toBe(false);
    expect(dup.error).toMatch(/đang mở/i);
    expect(dup.error).toContain(out.id);

    // xóa mềm DM mở → không còn chặn (điều kiện deleted_at='' — lệch có chủ đích vs v3.6)
    const del = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: out.id }), 'dmDelete');
    expect(del.ok).toBe(true);
    const re = await callOk(await rpc(getKhoToken(), 'dmFromSC', { sc_id: scId }), 'dmFromSC');
    expect(re.ok).toBe(true);
    expect(re.id).not.toBe(out.id);

    // duyệt DM mới → v3.6: chỉ 'cho_duyet' mới chặn → DM da_duyet KHÔNG chặn nữa
    // (cầu still can_mua — port NGUYÊN, hành vi gốc; ghi Production Check)
    await rpc(getGiamdocToken(), 'dmDecide', { id: re.id, quyet: 'duyet' });
    const third = await callOk(await rpc(getKhoToken(), 'dmFromSC', { sc_id: scId }), 'dmFromSC');
    expect(third.ok).toBe(true); // không chặn khi DM cũ đã duyệt
    // dọn: xóa DM da_duyet bị guard chặn (W2a) → giữ lại DM thứ 3 cho_duyet rồi xóa
    const delApproved = await callOk(await rpc(getKhoToken(), 'dmDelete', { id: re.id }), 'dmDelete');
    expect(delApproved.ok).toBe(false); // da_duyet không xóa được — regress guard
    await rpc(getKhoToken(), 'dmDelete', { id: third.id });
  });

  test('(5) dmAutoBu: bù đúng ton_min − ton, nhiều dòng 1 DM không sc_id; bỏ VT đã có DM cho_duyet/da_duyet; audit ly_do', async () => {
    const mk = async (ten: string, gia: number, tonMin: number) => {
      const r = await rpc(getKhoToken(), 'vattuCreate', { ten, don_vi: 'cái', gia, ton_min: tonMin });
      expect(r.body.ok).toBe(true);
      return r.body.result.id as string;
    };
    const b1 = await mk('W2b BU 1000đ min8', 1000, 8);   // thiếu 8  → vào bù
    const b2 = await mk('W2b BU 500đ min20', 500, 20);   // thiếu 20 → vào bù
    const b3 = await mk('W2b BU 100đ min5', 100, 5);     // thiếu 5 nhưng đã có DM cho_duyet → BỎ
    const b4 = await mk('W2b BU 100đ min4', 100, 4);     // có DM da_duyet → BỎ (v3.6: IN 2 trạng thái)

    // DM phủ b3 (cho_duyet) và b4 (duyet → da_duyet)
    const r3 = await rpc(getKhoToken(), 'dmCreate', { ngay: today(), items: [{ vattu_id: b3, so_luong: 2, don_gia: 100 }] });
    expect(r3.body.ok).toBe(true);
    const dm3 = r3.body.result.id as string;
    const dm4 = await mkDm(b4, 2, 100);
    const ap4 = await callOk(await rpc(getGiamdocToken(), 'dmDecide', { id: dm4, quyet: 'duyet' }), 'dmDecide');
    expect(ap4.ok).toBe(true);
    expect(dm3).toMatch(/^DM-\d{6}$/);

    const bu = await callOk(await rpc(getKhoToken(), 'dmAutoBu'), 'dmAutoBu');
    expect(bu.ok).toBe(true);
    expect(bu.id).toMatch(/^DM-\d{6}$/);
    expect(bu.so_dong).toBe(2);                                    // đúng b1+b2, không b3/b4
    expect(bu.tong).toBe(Math.round((8 * 1000 + 20 * 500) * 100) / 100);
    const det = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: bu.id }), 'dmDetail');
    const ids = det.items.map((x: any) => x.vattu_id).sort();
    expect(ids).toEqual([b1, b2].sort());
    for (const it of det.items) {
      if (it.vattu_id === b1) { expect(Number(it.so_luong)).toBe(8); expect(Number(it.don_gia)).toBe(1000); }
      if (it.vattu_id === b2) { expect(Number(it.so_luong)).toBe(20); expect(Number(it.don_gia)).toBe(500); }
    }
    const hdr = await db.query('SELECT sc_id, ly_do FROM dm WHERE id = $1', [bu.id]);
    expect(hdr.rows[0].sc_id).toBeNull();                          // DM bù KHÔNG gắn SC (v3.6)
    expect(hdr.rows[0].ly_do).toBe('Tự động bổ sung tồn tối thiểu'); // nguyễn văn v3.6 ghi_chu
    const aud = await db.query(
      "SELECT hanh_dong, mo_ta FROM activity_log WHERE hanh_dong='dm_tao' AND doi_tuong_id=$1", [bu.id]
    );
    expect(aud.rows.length).toBe(1);                               // audit CÙNG tx với DM
    expect(aud.rows[0].mo_ta).toMatch(/Tự động bổ sung tồn tối thiểu/); // §7: audit 'dm_tao' autoBu ly_do

    // idempotent tương đối: gọi lại → toàn bộ cầu đã phủ bởi DM mở chính nó
    const again = await callOk(await rpc(getKhoToken(), 'dmAutoBu'), 'dmAutoBu');
    expect(again.ok).toBe(true);
    expect(again.id).toBeNull();
    expect(again.message).toMatch(/Không cần bổ sung tồn/);
  });

  test('(6) RBAC spot: anon 401; xuong/ketoan gate decide OK nhưng core từ chối quyền; dmFromSC/dmAutoBu cần kho.tao', async () => {
    for (const fn of ['dmDecide', 'dmFromSC', 'dmAutoBu']) {
      expect((await anon(fn, {})).status).toBe(401);
    }
    const xuong = getXuongToken();
    expect((await rpc(xuong, 'dmFromSC', { sc_id: scId })).status).toBe(403); // không kho.tao
    expect((await rpc(xuong, 'dmAutoBu')).status).toBe(403);
    // xuong QUA gate ['kho','xem'] → core phán: không thuộc tập duyệt v3.6
    const dmOpen = await mkDm(vtP2, 5, 10);
    const x = await callOk(await rpc(xuong, 'dmDecide', { id: dmOpen, quyet: 'duyet' }), 'dmDecide');
    expect(x.ok).toBe(false);
    expect(x.error).toMatch(/Giám đốc/);
    // validate input trước khi động nghiệp vụ
    const v = await callOk(await rpc(xuong, 'dmDecide', {}), 'dmDecide');
    expect(v.ok).toBe(false); expect(v.error).toMatch(/id/);
    const vq = await callOk(await rpc(getKhoToken(), 'dmDecide', { id: dmOpen, quyet: 'ok' }), 'dmDecide'); // tên action v3.6 — KHÔNG còn hợp lệ
    expect(vq.ok).toBe(false); expect(vq.error).toMatch(/quyet/);
    await rpc(getGiamdocToken(), 'dmDecide', { id: dmOpen, quyet: 'duyet' }); // dọn
    // lọc trang_thai da_duyet end-to-end (đồng bộ contracts/core/schema)
    const list = await callOk(await rpc(getKhoToken(), 'dmList', { trang_thai: 'da_duyet' }), 'dmList');
    expect(list.ok).toBe(true);
    expect(list.result.some((r2: any) => r2.id === dmOpen)).toBe(true);
  });

  test('(7) W2c dmNhap — chỉ nhập khi da_duyet: cho_duyet/tu_choi/da_nhap chặn; sau giamdoc duyet → OK, ton tăng đúng', async () => {
    // Nguồn v3.6: kho.js phNhapCreate dòng 341–343 — ref_dm phải 'da_duyet'.
    // Guard nằm TRONG tx sau FOR UPDATE, TRƯỚC mọi UPDATE vattu.ton → phong
    // double-add: DM da_nhap nhập lại cũng bị chặn (cùng điều kiện !== da_duyet).
    const dm = await mkDm(vtP1, 2, 100); // tong 200 — dưới ngưỡng default 5tr
    const ton0 = Number((await db.query('SELECT ton FROM vattu WHERE id = $1', [vtP1])).rows[0].ton);

    // (a) còn cho_duyet: kho QUA gate ['kho','tao'] → core W2c từ chối envelope.
    const b1 = await callOk(await rpc(getKhoToken(), 'dmNhap', { dm_id: dm }), 'dmNhap');
    expect(b1.ok).toBe(false);
    expect(b1.error).toMatch(/Chỉ nhập khi đề nghị đã duyệt/);
    // xuong không có kho.tao → 403 ở gate RPC (RBAC W2a không đổi bởi W2c)
    expect((await rpc(getXuongToken(), 'dmNhap', { dm_id: dm })).status).toBe(403);
    // bị chặn → tồn KHÔNG dịch chuyển (guard đứng TRƯỚC mọi UPDATE ton)
    expect(
      Number((await db.query('SELECT ton FROM vattu WHERE id = $1', [vtP1])).rows[0].ton)
    ).toBe(ton0);

    // (b) tu_choi (ketoan trong ngưỡng) → guard vẫn chặn (khác 'da_duyet')
    const rej = await callOk(
      await rpc(getKetoanToken(), 'dmDecide', { id: dm, quyet: 'tu_choi', ly_do: 'W2c: không cần nữa' }),
      'dmDecide'
    );
    expect(rej.ok).toBe(true);
    const b2 = await callOk(await rpc(getKhoToken(), 'dmNhap', { dm_id: dm }), 'dmNhap');
    expect(b2.ok).toBe(false);
    expect(b2.error).toMatch(/Chỉ nhập khi đề nghị đã duyệt/);

    // (c) DM mới được giamdoc duyệt → nhập OK; ton tăng ĐÚNG bằng so_luong DM
    const dm2 = await mkDm(vtP1, 3, 100);
    const ap = await callOk(await rpc(getGiamdocToken(), 'dmDecide', { id: dm2, quyet: 'duyet' }), 'dmDecide');
    expect(ap.ok).toBe(true);
    expect(ap.trang_thai).toBe('da_duyet');
    const nhap = await callOk(await rpc(getKhoToken(), 'dmNhap', { dm_id: dm2 }), 'dmNhap');
    expect(nhap.ok).toBe(true);
    expect(
      Number((await db.query('SELECT ton FROM vattu WHERE id = $1', [vtP1])).rows[0].ton)
    ).toBe(ton0 + 3);
    // (c2) nhập LẶP sau da_nhap → chặn (chống cộng ton hai lần — v3.6 cùng nhánh)
    const b3 = await callOk(await rpc(getKhoToken(), 'dmNhap', { dm_id: dm2 }), 'dmNhap');
    expect(b3.ok).toBe(false);
    expect(b3.error).toMatch(/Chỉ nhập khi đề nghị đã duyệt/);
    expect(
      Number((await db.query('SELECT ton FROM vattu WHERE id = $1', [vtP1])).rows[0].ton)
    ).toBe(ton0 + 3);

    // (d) W2c: dmDetail expose cột duyệt — trạng thái sau chuỗi duyệt+nhập
    const det = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: dm2 }), 'dmDetail');
    expect(det.dm.trang_thai).toBe('da_nhap');
    expect(String(det.dm.nguoi_duyet).length).toBeGreaterThan(0);
    expect(det.dm.ngay_duyet).toBe(today());
    expect(det.dm.ly_do).toBe(''); // duyệt KHÔNG ghi lý do (nguyên v3.6)
    const detRej = await callOk(await rpc(getKhoToken(), 'dmDetail', { id: dm }), 'dmDetail');
    expect(detRej.dm.ly_do).toBe('W2c: không cần nữa'); // tu_choi → lộ lý do qua envelope
  });
});
