/**
 * sc_approve.test.ts — W3.5 (XƯỞNG): scApprove theo NGƯỠNG TIỀN + scTongDuyet
 * chốt SNAPSHOT bất biến `sc_phien_ban` + trạng thái `da_duyet` (port v3.6
 * sc.js:190–256/208–235 + perm.js:109–117 + seed.js:259 default 5.000.000đ).
 *
 * Ánh xạ role v3.6→v5 (lib/perm.ts W3.5 comment — QUYẾT ĐỊNH PORT, báo coordinator):
 *  - v3.6 admin/giamdoc duyệt VÔ HẠN            → v5 giữ nguyên (giamdoc/admin).
 *  - v3.6 'quanly' duyệt khi tong ≤ ngưỡng      → v5 'xuong' (role đã gộp trách
 *    nhiệm quản lý; W3.1 dashboard mapping tương tự). ⇒ xuong OK với tong nhỏ,
 *    chặn chứa 'Giám đốc' khi tong > ngưỡng.
 *  - v3.6 ketoan/xuong/kho/tho KHÔNG có sc.duy  → v5 ketoan/kho 403 dispatch
 *    (META ['sc','duy']).
 *
 * Kiểm chứng: (0) registry/contracts/docs/MCP WRITE-deny; (1) schema CHECK mới
 * + bảng sc_phien_ban + UNIQUE partial; (2) ngưỡng self-seed 5.000.000 (đúng số
 * v3.6) + duyệt trong/ngoài ngưỡng per-role + cột nguoi_duyet/ngay_duyet + audit;
 * (3) ngưỡng=0 → xuong chặn mọi phiếu; (4) tổng-duyệt: gate trạng thái, gate
 * ngưỡng, snapshot đúng 1 dòng {sc,cong,vat,baoGia,chot}, chốt lại bị chặn,
 * mọi cổng dòng + THÊM dòng chết sau chốt (bất biến); (5) dual-track
 * scBatDauSua: de_xuat vẫn masuk KHÔNG chốt (tương thích W0.2→W3.3A), da_duyet
 * → TỰ chốt snapshot kiểu v3.6 scStart:264–266 rồi dang_sua.
 *
 * CONFIG RESTORE: ngưỡng chỉnh trực tiếp qua db ở (3), restore finally + afterAll
 * (xóa key nếu suite làm self-seed mà DB vốn chưa có — pattern dm_decide (2)).
 * Per-file runner: DB fresh (globalSetup DROP/CREATE+seed) → không rác liên suite.
 */
import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken } from './setup';
import { db } from '../../lib/db';
import { getRegistry } from '../../lib/rpc';
import { RPC_SCHEMAS } from '../../lib/contracts';
import { PART6 } from '../../mcp-server/tool-docs.part6';
import { isWriteAllowed } from '../../mcp-server/auth';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

const today = () => new Date().toISOString().split('T')[0];
const NGUONG_KEY = 'duyet_sc_nguong';

/** body = {ok:true,result:<envelope core>}; W3.5 fn LUÔN envelope {ok,...} (200). */
async function callOk(res: any, fn: string) {
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  const payload = res.body.result;
  expect(payload && typeof payload.ok === 'boolean').toBe(true);
  return payload as any;
}

/** SC mới (xuong ⇒ is_test=0, de_xuat) + 1 dòng CV tong = sl × đơn giá. Trả ids. */
async function mkSc(xeId: string, ten: string, sl: number, donGia: number): Promise<{ sc: string; cv: string }> {
  const c = await rpc(getXuongToken(), 'scCreate', { xe_id: xeId, ngay: today() });
  expect(c.body.ok).toBe(true);
  const scId = c.body.result.id as string;
  createdSc.push(scId);
  const cv = await rpc(getXuongToken(), 'scAddCongViec', { sc_id: scId, mo_ta: ten, so_luong: sl, don_gia: donGia });
  expect(cv.body.ok).toBe(true);
  return { sc: scId, cv: cv.body.result.id as string };
}

const createdSc: string[] = [];
let nguongBefore: { exists: boolean; value: string } = { exists: false, value: '' };

jest.setTimeout(90000);

afterAll(async () => {
  // restore config + dọn fixture (sc_phien_ban phải xóa TRƯỚC sc — FK; chính dòng
  // snapshot của suite này, không đụng dữ liệu khác vì sc_id lọc theo createdSc)
  if (nguongBefore.exists) {
    await db.query('UPDATE config SET value = $1 WHERE key = $2', [nguongBefore.value, NGUONG_KEY]);
  } else {
    await db.query('DELETE FROM config WHERE key = $1', [NGUONG_KEY]);
  }
  if (createdSc.length) {
    await db.query('DELETE FROM sc_phien_ban WHERE sc_id = ANY($1::text[])', [createdSc]);
    await db.query("UPDATE sc SET deleted_at=$2 WHERE id=ANY($1::text[])", [createdSc, today()]);
    await db.query("UPDATE sc_congviec SET deleted_at=$2 WHERE sc_id=ANY($1::text[])", [createdSc, today()]);
  }
});

describe('W3.5 SC duyệt — scApprove ngưỡng + scTongDuyet snapshot (port v3.6)', () => {
  let xeId = '';
  let scSmall = ''; let cvSmall = '';
  let scBig = ''; let cvBig = '';
  let scAuto = ''; // (2) xuong duyệt nhỏ → (5) start auto-chot
  let scRej = '';  // (5) từ chối → gate start vẫn đóng

  beforeAll(async () => {
    const xe = await db.query("SELECT id FROM xe WHERE deleted_at = '' ORDER BY id LIMIT 1");
    expect(xe.rows.length).toBeGreaterThan(0);
    xeId = xe.rows[0].id;
    const cfg = await db.query('SELECT value FROM config WHERE key = $1', [NGUONG_KEY]);
    nguongBefore = cfg.rows.length
      ? { exists: true, value: String(cfg.rows[0].value) }
      : { exists: false, value: '' };
  });

  /* ═══ (0) registry/contracts/docs/MCP — 2 fn WRITE mới wired đủ 4 tầng ═══ */
  test('(0) FN_LIST+META [sc,duy]+contracts id+PART6 WRITE; MCP deny mặc định', () => {
    const reg = getRegistry();
    for (const fn of ['scApprove', 'scTongDuyet']) {
      expect(reg.FN_LIST).toContain(fn);
      expect(reg.OPEN.has(fn)).toBe(false);
      expect(reg.META[fn]).toEqual(['sc', 'duy']); // v3.6 handlers.js:680/726 nguyên cặp quyền
      expect(RPC_SCHEMAS[fn]).toBeDefined();
      expect(PART6[fn]).toBeDefined();
      expect(PART6[fn].mode).toBe('WRITE');
      expect(isWriteAllowed(fn)).toBe(false); // ∉ READ_TOOLS ∧ allowlist rỗng → deny
    }
    // schema {id} trần 1..12 — 2 tầng như scWorkSet
    expect(Object.keys(RPC_SCHEMAS.scApprove)).toEqual(['id']);
  });

  /* ═══ (1) schema: CHECK nhận da_duyet + cột mới + sc_phien_ban UNIQUE partial ═══ */
  test('(1) CHECK da_duyet + nguoi_duyet/ngay_duyet + sc_phien_ban 1 dòng sống/SC', async () => {
    const cols = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='sc' AND column_name IN ('nguoi_duyet','ngay_duyet')"
    );
    expect(cols.rows.map((c: any) => c.column_name).sort()).toEqual(['ngay_duyet', 'nguoi_duyet']);
    const tb = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='sc_phien_ban'"
    );
    expect(tb.rows.map((c: any) => c.column_name).sort()).toEqual(
      ['deleted_at', 'id', 'ngay_chot', 'Nguoi_chot'.toLowerCase(), 'sc_id', 'snapshot']
    );
    // trạng thái mới qua CHECK
    const chk = 'SC-W35CHECK';
    await db.query(
      "INSERT INTO sc (id, xe_id, trang_thai, ngay_tao, tong, is_test, deleted_at) VALUES ($1,$2,'da_duyet',$3,0,1,'')",
      [chk, xeId, today()]
    );
    // UNIQUE partial: 2 dòng sống cùng sc_id → 23505
    await db.query(
      "INSERT INTO sc_phien_ban (sc_id, nguoi_chot, ngay_chot, snapshot) VALUES ($1,'U-TEST',$2,'{}')", [chk, today()]
    );
    let dupErr: any = null;
    try {
      await db.query(
        "INSERT INTO sc_phien_ban (sc_id, nguoi_chot, ngay_chot, snapshot) VALUES ($1,'U-TEST',$2,'{}')", [chk, today()]
      );
    } catch (e: any) { dupErr = e; }
    expect(dupErr && dupErr.code).toBe('23505');
    await db.query('DELETE FROM sc_phien_ban WHERE sc_id=$1', [chk]);
    await db.query('DELETE FROM sc WHERE id=$1', [chk]);
  });

  /* ═══ (2) ngưỡng 5.000.000 (self-seed số v3.6) + duyệt theo role ═══ */
  test('(2) xuong ≤ ngưỡng OK + cột duyệt; > ngưỡng chặn "Giám đốc"; ketoan/kho 403; giamdoc vô hạn', async () => {
    ({ sc: scSmall, cv: cvSmall } = await mkSc(xeId, 'W35 nhỏ 1.000đ', 1, 1000));          // tong 1.000
    ({ sc: scBig, cv: cvBig } = await mkSc(xeId, 'W35 lớn 10tr', 5, 2000000));             // tong 10.000.000
    ({ sc: scAuto } = await mkSc(xeId, 'W35 auto-chot 2.000đ', 1, 2000));                  // cho (5)

    // lệnh duyệt ĐẦU TIÊN self-seed key = đúng số v3.6 seed.js:259
    const first = await callOk(await rpc(getXuongToken(), 'scApprove', { id: scBig }), 'scApprove');
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/Giám đốc/);
    expect(first.error).toMatch(/Chưa đủ quyền duyệt/);
    const seeded = await db.query('SELECT value FROM config WHERE key = $1', [NGUONG_KEY]);
    expect(Number(seeded.rows[0].value)).toBe(5000000);
    // phiếu bị chặn KHÔNG đổi trạng thái/người duyệt (message v3.6 không đổi dữ liệu)
    const untouched = await db.query('SELECT trang_thai, nguoi_duyet, ngay_duyet FROM sc WHERE id=$1', [scBig]);
    expect(untouched.rows[0]).toMatchObject({ trang_thai: 'de_xuat', nguoi_duyet: '', ngay_duyet: '' });

    // xuong trong ngưỡng → DUYỆT + ghi người/ngày (v3.6 sc.js:199)
    const small = await callOk(await rpc(getXuongToken(), 'scApprove', { id: scSmall }), 'scApprove');
    expect(small.ok).toBe(true);
    expect(small.trang_thai).toBe('da_duyet');
    const rowS = await db.query('SELECT trang_thai, nguoi_duyet, ngay_duyet FROM sc WHERE id=$1', [scSmall]);
    expect(rowS.rows[0].trang_thai).toBe('da_duyet');
    expect(rowS.rows[0].nguoi_duyet).toBe('U-XUONG');
    expect(rowS.rows[0].ngay_duyet).toBe(today());
    const aud = await db.query(
      "SELECT mo_ta FROM activity_log WHERE hanh_dong='sc_duyet' AND doi_tuong_id=$1 ORDER BY id DESC LIMIT 1", [scSmall]
    );
    expect(aud.rows[0].mo_ta).toBe('Duyệt phiếu'); // v3.6:203 nguyên văn

    // duyệt lại trên phiếu đã duyệt → 'Đang Đã duyệt — không duyệt được.' (v3.6:194)
    const again = await callOk(await rpc(getXuongToken(), 'scApprove', { id: scSmall }), 'scApprove');
    expect(again.ok).toBe(false);
    expect(again.error).toMatch(/^Đang Đã duyệt — không duyệt được\.$/);

    // validate input trước nghiệp vụ
    const badId = await callOk(await rpc(getXuongToken(), 'scApprove', {}), 'scApprove');
    expect(badId.ok).toBe(false); expect(badId.error).toMatch(/id/);

    // role ngoài tập duyệt v3.6 chết ở DISPATCH (403 — không có envelope):
    expect((await rpc(getKetoanToken(), 'scApprove', { id: scBig })).status).toBe(403);
    expect((await rpc(getKhoToken(), 'scApprove', { id: scBig })).status).toBe(403);
    expect((await rpc(getKetoanToken(), 'scTongDuyet', { id: scSmall })).status).toBe(403);

    // giamdoc trên ngưỡng → OK (vô hạn — v3.6 canApproveSC)
    const gd = await callOk(await rpc(getGiamdocToken(), 'scApprove', { id: scBig }), 'scApprove');
    expect(gd.ok).toBe(true);
    expect(gd.trang_thai).toBe('da_duyet');
    // admin cũng vô hạn (bypass): chuẩn bị 1 phiếu cho nhánh admin ở (5) reuse scAuto
    const au = await callOk(await rpc(getAdminToken(), 'scApprove', { id: scAuto }), 'scApprove');
    expect(au.ok).toBe(true);
    expect(au.trang_thai).toBe('da_duyet'); // admin duyệt — nguoi_duyet sẽ là U-ADMIN
  });

  /* ═══ (3) ngưỡng=0 ⇒ xuong chặn MỌI phiếu (v3.6 configGet default 0语义) ═══ */
  test('(3) ngưỡng 0: xuong bị chặn cả phiếu 1.000đ — message còn "Giám đốc"', async () => {
    await db.query('UPDATE config SET value = $1 WHERE key = $2', ['0', NGUONG_KEY]);
    try {
      const { sc } = await mkSc(xeId, 'W35 ngưỡng0', 1, 1000);
      const r = await callOk(await rpc(getXuongToken(), 'scApprove', { id: sc }), 'scApprove');
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/Giám đốc/);
      // nhưng giamdoc vẫn duyệt bình thường (không phụ thuộc ngưỡng)
      const g = await callOk(await rpc(getGiamdocToken(), 'scApprove', { id: sc }), 'scApprove');
      expect(g.ok).toBe(true);
    } finally {
      await db.query('UPDATE config SET value = $1 WHERE key = $2', ['5000000', NGUONG_KEY]);
    }
  });

  /* ═══ (4) scTongDuyet: gates + snapshot ĐÚNG 1 dòng + BẤT BIẾN sau chốt ═══ */
  test('(4) tổng duyệt de_xuat chặn; >ngưỡng chặn; chốt 1 snapshot; sửa/thêm dòng sau chốt CHẶN', async () => {
    // gate 1: còn de_xuat → 'chỉ tổng duyệt khi Đã duyệt.' (v3.6:242)
    const { sc: scDraft } = await mkSc(xeId, 'W35 draft', 1, 100);
    const tooEarly = await callOk(await rpc(getGiamdocToken(), 'scTongDuyet', { id: scDraft }), 'scTongDuyet');
    expect(tooEarly.ok).toBe(false);
    expect(tooEarly.error).toMatch(/chỉ tổng duyệt khi Đã duyệt/);

    // scBig đã da_duyet (10tr) ở (2) — xuong TỔNG duyệt ngoài ngưỡng → chặn (v3.6:245 message)
    const xu = await callOk(await rpc(getXuongToken(), 'scTongDuyet', { id: scBig }), 'scTongDuyet');
    expect(xu.ok).toBe(false);
    expect(xu.error).toMatch(/Chưa đủ quyền tổng duyệt/);
    expect(xu.error).toMatch(/Giám đốc/);

    // giamdoc chốt: OK + snapshot {sc,cong,vat,baoGia,chot} — 1 dòng DUY NHẤT
    const tk = await callOk(await rpc(getGiamdocToken(), 'scTongDuyet', { id: scBig }), 'scTongDuyet');
    expect(tk.ok).toBe(true);
    expect(tk.chot).toBe(true);
    expect(tk.snapshot).toBe(true);
    expect(tk.trang_thai).toBe('da_duyet'); // v5 dual-track: không có da_tong_duyet (schema W3.5 note #1)
    const pb = await db.query("SELECT nguoi_chot, ngay_chot, snapshot FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''", [scBig]);
    expect(pb.rows).toHaveLength(1);
    expect(pb.rows[0].nguoi_chot).toBe('U-GIAMDOC');
    expect(pb.rows[0].ngay_chot).toBe(today());
    const snap = JSON.parse(pb.rows[0].snapshot);
    expect(Object.keys(snap).sort()).toEqual(['baoGia', 'chot', 'cong', 'sc', 'vat']); // đúng bộ khóa v3.6:226
    expect(snap.sc.id).toBe(scBig);
    expect(Array.isArray(snap.cong)).toBe(true);
    expect(snap.cong).toHaveLength(1);
    expect(snap.cong[0].mo_ta).toBe('W35 lớn 10tr');
    expect(snap.vat).toEqual([]);
    expect(snap.baoGia).toEqual([]);
    expect(snap.chot).toMatchObject({ nguoi: 'U-GIAMDOC', ngay: today(), lyDo: '' });
    const aud = await db.query(
      "SELECT mo_ta FROM activity_log WHERE hanh_dong='sc_tong_duyet' AND doi_tuong_id=$1", [scBig]
    );
    expect(aud.rows).toHaveLength(1);
    expect(aud.rows[0].mo_ta).toBe('Tổng duyệt kế hoạch sửa chữa (đã lưu phiên bản)'); // v3.6:250

    // chốt LẠI → chặn; DB vẫn 1 dòng sống
    const again = await callOk(await rpc(getGiamdocToken(), 'scTongDuyet', { id: scBig }), 'scTongDuyet');
    expect(again.ok).toBe(false);
    expect(again.error).toMatch(/đã chốt/);
    const cnt = await db.query("SELECT COUNT(*)::int n FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''", [scBig]);
    expect(cnt.rows[0].n).toBe(1);

    // ── SAU CHỐT: mọi cổng dòng + THÊM dòng chặn (bất biến thật sự) ──
    const w = await rpc(getXuongToken(), 'scWorkSet', { id: cvBig, mo_ta: 'xé chốt' });
    expect(w.status).toBe(400);
    expect(w.body.error).toMatch(/đã chốt/);
    const d = await rpc(getXuongToken(), 'scWorkDel', { id: cvBig });
    expect(d.status).toBe(400); expect(d.body.error).toMatch(/đã chốt/);
    const a1 = await rpc(getXuongToken(), 'scAddCongViec', { sc_id: scBig, mo_ta: 'thêm chui', so_luong: 1, don_gia: 1 });
    expect(a1.status).toBe(400); expect(a1.body.error).toMatch(/đã chốt/);
    // cổng VT: cắm dòng sống qua DB (UI hết đường) → scVtUpd phải chặn 'đã chốt', không phải gate de_xuat
    const vtId = 'VT-W35CHOT';
    await db.query(
      "INSERT INTO sc_vattu (id, sc_id, vattu_id, so_luong, gd_dk, deleted_at) VALUES ($1,$2,'VT-000001',1,10,'')",
      [vtId, scBig]
    );
    try {
      const v = await rpc(getXuongToken(), 'scVtUpd', { id: vtId, so_luong: 9 });
      expect(v.status).toBe(400);
      expect(v.body.error).toMatch(/đã chốt/);
      const a2 = await rpc(getXuongToken(), 'scAddVatTu', { sc_id: scBig, vattu_id: 'VT-000001', so_luong: 1 });
      expect(a2.status).toBe(400); expect(a2.body.error).toMatch(/đã chốt/);
    } finally {
      await db.query('DELETE FROM sc_vattu WHERE id=$1', [vtId]); // dọn row test (pattern sc_workline TC3)
    }
    // tong KHÔNG đổi sau mọi nỗ lực xé (recalc không còn đường chạm dữ liệu snapshot)
    const tot = await db.query('SELECT tong, tong_cong FROM sc WHERE id=$1', [scBig]);
    expect(Number(tot.rows[0].tong)).toBe(10000000);
    expect(Number(tot.rows[0].tong_cong)).toBe(10000000);
    // snapshot STILL original (json chưa từng bị ghi đè — DO UPDATE không đường nào chạm)
    const pb2 = await db.query("SELECT snapshot FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''", [scBig]);
    expect(pb2.rows[0].snapshot).toBe(pb.rows[0].snapshot);
  });

  /* ═══ (5) scBatDauSua DUAL-TRACK: de_xuat vẫn vào KHÔNG chốt; da_duyet tự chốt ═══ */
  test('(5) start de_xuat không snapshot (tương thích W0); start da_duyet → auto-chot + dang_sua', async () => {
    // de_xuat (572-test đường cũ): vào thẳng, KHÔNG sinh snapshot
    const { sc: scLegacy } = await mkSc(xeId, 'W35 legacy', 1, 500);
    const legacy = await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scLegacy });
    expect(legacy.body.ok).toBe(true);
    expect(legacy.body.result.ok).toBe(true);
    expect(legacy.body.result.chot).toBeUndefined(); // TODO(W3.6) siết: chỉ từ da_duyet (v3.6 scStart:261)
    const noSnap = await db.query("SELECT COUNT(*)::int n FROM sc_phien_ban WHERE sc_id=$1", [scLegacy]);
    expect(noSnap.rows[0].n).toBe(0);
    expect((await db.query('SELECT trang_thai FROM sc WHERE id=$1', [scLegacy])).rows[0].trang_thai).toBe('dang_sua');

    // da_duyet (admin duyệt ở (2)) → start = v3.6 scStart: TỰ chốt snapshot (người start) rồi dang_sua
    const st = await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scAuto });
    expect(st.body.ok).toBe(true);
    expect(st.body.result.chot).toBe(true);
    const pb = await db.query("SELECT nguoi_chot, snapshot FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''", [scAuto]);
    expect(pb.rows).toHaveLength(1);                      // auto-chot giống nhánh !exist v3.6:265–266
    expect(pb.rows[0].nguoi_chot).toBe('U-XUONG');        // v3.6: snapshotSC(id, meId()) — người START là người chốt
    const snap = JSON.parse(pb.rows[0].snapshot);
    expect(snap.sc.trang_thai).toBe('da_duyet');          // snapshot bắt lúc VÔ trạng thái duyệt (trước flip dang_sua)
    expect((await db.query('SELECT trang_thai FROM sc WHERE id=$1', [scAuto])).rows[0].trang_thai).toBe('dang_sua');

    // trạng thái khác vẫn gate (tu_choi không vào được start — dual-track chỉ mở 2 cửa)
    ({ sc: scRej } = await mkSc(xeId, 'W35Reject', 1, 500));
    expect((await rpc(getXuongToken(), 'scTuChoi', { sc_id: scRej, ly_do: 'W35 test' })).body.ok).toBe(true);
    const rej = await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scRej });
    expect(rej.status).toBe(400);
    expect(rej.body.error).toMatch(/Không thể bắt đầu sửa khi phiếu đang/);
    // phiếu CHƯA chốt nhưng đã dang_sua: gate de_xuat thường (không phải 'chốt')
    const w = await rpc(getXuongToken(), 'scWorkSet', { id: 'CV-999999', mo_ta: 'x' });
    expect(w.status).toBe(400); // 'Không thấy hạng mục' trước mọi gate (thứ tự v3.6)
  });
});
