/**
 * sc_workline.test.ts — W3.3A TRỤC XƯỞNG: dòng công việc + vật tư + deadline + thợ
 * Port v3.6 server/sc.js scWorkSet/scWorkDel/scVtUpd/scVtDel/scSetDeadline +
 * handlers.js thoList. KiỂM chứng theo v5 schema THẬT (sau ALTER W3.3A):
 *  - sc_congviec.tho_id + sc.han_tra_xe tồn tại; enum tt v5 = cho|dang|hoan
 *    (KHÁC v3.6 'todo' — core nhận 'todo' alias → ghi 'cho').
 *  - Gate v5 (chặt hơn v3.6 ACTIVE_STATUS): MỌI sửa/xóa dòng chỉ khi de_xuat —
 *    'Chỉ sửa khi đề xuất.'; scSetDeadline CHẶN de_xuat|tu_choi|da_quyet (đúng v3.6
 *    sc.js:281), cho dang_sua|da_hoan; '' = xóa hẹn, regex YYYY-MM-DD.
 *  - ĐÓNG WIRESH_PRICE: scAddVatTu nhận don_gia/gd_dk → INSERT gd_dk → recalc
 *    tong_vt tính cả giá này (fixture W0.2 giữ nguyên vì fallback vattu.gia KHÔNG
 *    được port — có chủ đích, xem sc.ts).
 *  - MỌI hàm sửa dòng gọi recalcScTotals CUỐI: tổng quy tụ đúng sau add/set/del.
 *  - so_luong/don_gia/gd_dk ÂM bị chặn (gatekeeper v5 — v3.6 không chặn).
 *  - thoList: users role='xuong' deleted_at='' (v3.6 'tho'+active=1 → mapping v5);
 *    META ['sc','xem'] — mọi role đọc được; MCP READ_TOOLS.
 *
 * HTTP /api/rpc (sid cookie) + db SELECT trực tiếp — pattern sc_totals/dm_decide;
 * server :3000 spawn bởi scripts/test-conformance.mjs (hoặc dev server đang chạy);
 * globalSetup DROP/CREATE schema + seed ⇒ U-XUONG đúng 1 user 'xuong' đầu run.
 */
import request from 'supertest';
import { getAdminToken, getXuongToken, getKhoToken, getGiamdocToken, getKetoanToken } from './setup';
import { db } from '../../lib/db';
import { getRegistry } from '../../lib/rpc';
import { RPC_SCHEMAS } from '../../lib/contracts';
import { PART5 } from '../../mcp-server/tool-docs.part5';
import { isWriteAllowed } from '../../mcp-server/auth';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });
const anon = (fn: string, args: any = {}) => request(BASE).post('/api/rpc').send({ fn, args });

const today = (): string => new Date().toISOString().split('T')[0];
const num = (v: any): number => Number(v); // pg NUMERIC → string → ép số

const GATE_MSG = 'Chỉ sửa khi đề xuất.'; // core sc.ts loadWorkLine/loadVatTuLine

async function totals(scId: string): Promise<{ tong_cong: number; tong_vt: number; tong: number }> {
  const res = await rpc(getAdminToken(), 'scGet', { id: scId });
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  const r = res.body.result;
  return { tong_cong: num(r.tong_cong), tong_vt: num(r.tong_vt), tong: num(r.tong) };
}

describe('W3.3A — SC workline: scWorkSet/scWorkDel/scVtUpd/scVtDel/scSetDeadline/thoList', () => {
  const FNS = ['scWorkSet', 'scWorkDel', 'scVtUpd', 'scVtDel', 'scSetDeadline', 'thoList'];
  const WRITE_FNS = ['scWorkSet', 'scWorkDel', 'scVtUpd', 'scVtDel', 'scSetDeadline'];

  let scA = ''; // SC chính: de_xuat → (TC2 gate) → dang_sua
  let cv1 = ''; // CV 2×100 → set 150 → 2×150=300 → delete → 250 còn
  let cv2 = ''; // CV 5×50=250 giữ lại đối chứng recalc GIẢM đúng
  let vt1 = ''; // VT 3×don_gia350=1050 → scVtUpd so_luong 4 → 1400 → scVtDel → 0
  let deadlineSc = ''; // SC cho nhánh hẹn trả xe (start xong mới đặt)

  test('(0) registry: 6 fn FN_LIST + META reads/writes đúng + contracts + PART5 docs + MCP deny mặc định', () => {
    const reg = getRegistry();
    for (const fn of FNS) {
      expect(reg.FN_LIST).toContain(fn);
      expect(Object.keys(reg.META)).toContain(fn); // fail-closed nếu quên META
      expect(reg.HANDLERS[fn]).toBeDefined();
      expect(RPC_SCHEMAS[fn]).toBeDefined();
      expect(PART5[fn]).toBeDefined();
    }
    // Meta theo spec: writes sc/sua — đúng khai báo v3.6 handlers.js:681–683; thoList đọc
    for (const fn of WRITE_FNS) expect(reg.META[fn]).toEqual(['sc', 'sua']);
    expect(reg.META['thoList']).toEqual(['sc', 'xem']);
    // Docs mode đúng bản chất: 5 WRITE + thoList READ
    for (const fn of WRITE_FNS) expect(PART5[fn].mode).toBe('WRITE');
    expect(PART5['thoList'].mode).toBe('READ');
    // MCP default (MCP_WRITE_TOOLS='' ở jest env): 5 write DENY, thoList READ allow
    for (const fn of WRITE_FNS) expect(isWriteAllowed(fn)).toBe(false);
    expect(isWriteAllowed('thoList')).toBe(true);
  });

  test('(0b) schema: cột mới tồn tại (sc_congviec.tho_id · sc.han_tra_xe)', async () => {
    const r = await db.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE (table_name='sc_congviec' AND column_name='tho_id') OR (table_name='sc' AND column_name='han_tra_xe')"
    );
    expect(r.rows.map((x: any) => `${x.table_name}.${x.column_name}`).sort())
      .toEqual(['sc.han_tra_xe', 'sc_congviec.tho_id']);
  });

  /* ═══ TC1 — de_xuat: add CV/VT → set → WIRESH don_gia→gd_dk → recalc ĐÚNG ═══ */
  test('TC1 — de_xuat: scAddCongViec/scWorkSet/scAddVatTu(don_gia)/scVtUpd → recalc chuẩn từng bước', async () => {
    const xe = await rpc(getXuongToken(), 'xeList');
    expect(xe.body.result.length).toBeGreaterThan(0);
    const sc = await rpc(getXuongToken(), 'scCreate', { xe_id: xe.body.result[0].id, ngay: today() });
    expect(sc.body.ok).toBe(true);
    scA = sc.body.result.id;
    expect(await totals(scA)).toEqual({ tong_cong: 0, tong_vt: 0, tong: 0 });

    // CV 2×100 = 200
    const add1 = await rpc(getXuongToken(), 'scAddCongViec', {
      sc_id: scA, mo_ta: 'W33A CV 2×100', so_luong: 2, don_gia: 100,
    });
    expect(add1.body.ok).toBe(true);
    cv1 = add1.body.result.id;
    expect(await totals(scA)).toEqual({ tong_cong: 200, tong_vt: 0, tong: 200 });

    // scWorkSet: don_gia 100→150 (+ tt/stt/tho_id/nguyen_nhan một lượt) → recalc 300
    const set = await rpc(getXuongToken(), 'scWorkSet', {
      id: cv1, don_gia: 150, tt: 'dang', stt: 1, tho_id: 'U-XUONG', nguyen_nhan: 'mòn',
    });
    expect(set.status).toBe(200);
    expect(set.body.ok).toBe(true);
    expect(set.body.result).toEqual({ ok: true });
    expect(await totals(scA)).toEqual({ tong_cong: 300, tong_vt: 0, tong: 300 });
    const line = await db.query('SELECT tt, tho_id, nguyen_nhan, stt FROM sc_congviec WHERE id=$1', [cv1]);
    expect(line.rows[0]).toEqual({ tt: 'dang', tho_id: 'U-XUONG', nguyen_nhan: 'mòn', stt: 1 });

    // WIRESH_PRICE: key `don_gia` (UI page.tsx dòng 390-395) → INSERT gd_dk → tong_vt TÍNH CẢ GIÁ
    const addVt = await rpc(getXuongToken(), 'scAddVatTu', {
      sc_id: scA, vattu_id: 'VT-000001', so_luong: 3, don_gia: 350,
    });
    expect(addVt.body.ok).toBe(true);
    vt1 = addVt.body.result.id;
    const vtRow = await db.query('SELECT gd_dk, gd_tt FROM sc_vattu WHERE id=$1', [vt1]);
    expect(num(vtRow.rows[0].gd_dk)).toBe(350); // don_gia đã đổ đúng cột gd_dk
    expect(num(vtRow.rows[0].gd_tt)).toBe(0);
    expect(await totals(scA)).toEqual({ tong_cong: 300, tong_vt: 1050, tong: 1350 }); // 3×350
    // scGet (header) có bằng chứng giá dòng: tong_vt>0 — rows con XEM qua SELECT (trên)

    // scVtUpd: so_luong 3→4 → 4×350=1400 ; gd_dk đổi song song → 4×400=1600
    const upd = await rpc(getXuongToken(), 'scVtUpd', { id: vt1, so_luong: 4 });
    expect(upd.body.ok).toBe(true);
    expect(await totals(scA)).toEqual({ tong_cong: 300, tong_vt: 1400, tong: 1700 });
    const upd2 = await rpc(getXuongToken(), 'scVtUpd', { id: vt1, gd_dk: 400 });
    expect(upd2.body.ok).toBe(true);
    expect(await totals(scA)).toEqual({ tong_cong: 300, tong_vt: 1600, tong: 1900 });

    // alias 'todo' (v3.6) → ghi 'cho' (CHECK v5)
    const alias = await rpc(getXuongToken(), 'scWorkSet', { id: cv1, tt: 'todo' });
    expect(alias.body.ok).toBe(true);
    const l2 = await db.query('SELECT tt FROM sc_congviec WHERE id=$1', [cv1]);
    expect(l2.rows[0].tt).toBe('cho');

    // enum thật v5: tt sai phải bị chặn
    const bad = await rpc(getXuongToken(), 'scWorkSet', { id: cv1, tt: 'lam_linh' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain('Trạng thái công việc sai');

    // gd_tt>0 KHÔNG cấm sửa gd_dk (trả lời câu hỏi spec — đúng v3.6): set gd_tt qua
    // DB (luồng NGHIỆM THU, ngoài scVtUpd), rồi scVtUpd gd_dk → recalc chạy trong
    // cùng luồng → tong_vt theo CASE ưu tiên gd_tt, NOT gd_dk.
    await db.query('UPDATE sc_vattu SET gd_tt=500 WHERE id=$1', [vt1]);
    const keep = await rpc(getXuongToken(), 'scVtUpd', { id: vt1, gd_dk: 410 });
    expect(keep.status).toBe(200);
    expect(keep.body.ok).toBe(true); // GD_DK vẫn sửa được khi gd_tt>0 — v3.6 không cấm
    expect((await totals(scA)).tong_vt).toBe(2000); // 4×500 — CASE(gd_tt) thắng, gd_dk=410 nằm ngoài tổng
    await db.query('UPDATE sc_vattu SET gd_tt=0 WHERE id=$1', [vt1]);
    // trigger recalc bằng scVtUpd idempotent (so_luong giữ 4) → gd_dk=410 quay lại chi phối
    const trig = await rpc(getXuongToken(), 'scVtUpd', { id: vt1, so_luong: 4 });
    expect(trig.body.ok).toBe(true);
    expect(await totals(scA)).toMatchObject({ tong_vt: 1640 }); // 4×410
  });

  /* ═══ TC2 — delete dòng (de_xuat) → recalc GIẢM đúng; id lạ/từoi sai chặn ═══ */
  test('TC2 — scWorkDel/scVtDel soft-delete: tổng GIẢM đúng, không DELETE cứng', async () => {
    // thêm CV2 5×50=250 → tong_cong 300+250=550
    const add2 = await rpc(getXuongToken(), 'scAddCongViec', {
      sc_id: scA, mo_ta: 'W33A CV 5×50', so_luong: 5, don_gia: 50,
    });
    cv2 = add2.body.result.id;
    expect(await totals(scA)).toEqual({ tong_cong: 550, tong_vt: 1640, tong: 2190 });

    const del = await rpc(getXuongToken(), 'scWorkDel', { id: cv1 });
    expect(del.body.ok).toBe(true);
    expect(await totals(scA)).toEqual({ tong_cong: 250, tong_vt: 1640, tong: 1890 }); // cv1(-300)
    const still = await db.query('SELECT deleted_at FROM sc_congviec WHERE id=$1', [cv1]);
    expect(String(still.rows[0].deleted_at).length).toBeGreaterThan(0); // soft, không mất dòng
    expect(still.rows[0].deleted_at).not.toBe('');

    const delVt = await rpc(getXuongToken(), 'scVtDel', { id: vt1 });
    expect(delVt.body.ok).toBe(true);
    expect(await totals(scA)).toEqual({ tong_cong: 250, tong_vt: 0, tong: 250 }); // VT hết

    // id không tồn tại → đúng message v3.6
    const ghost = await rpc(getXuongToken(), 'scWorkDel', { id: 'CV-999999' });
    expect(ghost.status).toBe(400);
    expect(ghost.body.error).toContain('Không thấy hạng mục công việc');
    const ghostVt = await rpc(getXuongToken(), 'scVtDel', { id: 'VT-999999' });
    expect(ghostVt.body.error).toContain('Không thấy vật tư');
    // xóa dòng ĐÃ xóa → cũng 'không thấy' (deleted_at='' filter)
    const twice = await rpc(getXuongToken(), 'scWorkDel', { id: cv1 });
    expect(twice.status).toBe(400);
  });

  /* ═══ TC3 — gate dang_sua: mọi fn dòng chặn 'Chỉ sửa khi đề xuất.' ═══ */
  test('TC3 — sau scBatDauSua (dang_sua): scWorkSet/scWorkDel/scVtUpd/scVtDel đều gate de_xuat', async () => {
    const start = await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scA });
    expect(start.body.ok).toBe(true);

    // vt1 đã soft-delete ở TC2 → nếu dùng lại,Fn trả 'Không thấy vật tư.' TRƯỚC gate
    // (đúng thứ tự check v3.6: tìm dòng → gate). Cắm 1 dòng VT SỐNG vào scA qua DB
    // (luồng add bình thường không còn cửa vì phiếu đã start) để test đúng gate:
    await db.query(
      "INSERT INTO sc_vattu (id, sc_id, vattu_id, so_luong, gd_dk, deleted_at) VALUES ('VT-W33ATC3', $1, 'VT-000001', 5, 100, '')",
      [scA]
    );
    try {
      const cases: Array<[string, any]> = [
        ['scWorkSet', { id: cv2, don_gia: 1 }],
        ['scWorkDel', { id: cv2 }],
        ['scVtUpd', { id: 'VT-W33ATC3', so_luong: 9 }],
        ['scVtDel', { id: 'VT-W33ATC3' }],
      ];
      for (const [fn, args] of cases) {
        const res = await rpc(getXuongToken(), fn, args);
        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toBe(GATE_MSG);
      }
      // DB không đổi: cv2 còn sống + dòng VT thử vẫn nguyên, không deleted_at
      const chk = await db.query("SELECT COUNT(*)::int AS n FROM sc_congviec WHERE id=$1 AND deleted_at=''", [cv2]);
      expect(chk.rows[0].n).toBe(1);
      const chkVt = await db.query("SELECT COUNT(*)::int AS n FROM sc_vattu WHERE id='VT-W33ATC3' AND deleted_at=''", []);
      expect(chkVt.rows[0].n).toBe(1);
      // dòng đã xóa mềm → message 'không thấy', KHÔNG phải gate (thứ tự check đúng v3.6)
      const gone = await rpc(getXuongToken(), 'scVtDel', { id: vt1 });
      expect(gone.status).toBe(400);
      expect(gone.body.error).toBe('Không thấy vật tư.');
    } finally {
      await db.query("DELETE FROM sc_vattu WHERE id='VT-W33ATC3'"); // dọn test row
    }
  });

  /* ═══ TC4 — scSetDeadline: chặn de_xuat/tu_choi/da_quyet, OK dang_sua, regex, clear ═══ */
  test('TC4 — hẹn trả xe: de_xuat error · dang_sua OK+SELECT đúng · regex · clear "" · role', async () => {
    // SC mới còn de_xuat → CHẶN (đúng v3.6 sc.js:281)
    const scD = await rpc(getXuongToken(), 'scCreate', {
      xe_id: (await rpc(getXuongToken(), 'xeList')).body.result[0].id, ngay: today(),
    });
    expect(scD.body.ok).toBe(true);
    const scId = scD.body.result.id;
    const tooEarly = await rpc(getXuongToken(), 'scSetDeadline', { id: scId, han_tra_xe: '2026-09-20' });
    expect(tooEarly.status).toBe(400);
    expect(tooEarly.body.error).toContain('không đặt được ngày hẹn');

    // start → dang_sua → đặt OK, scGet + DB SELECT cùng thấy giá trị
    deadlineSc = scId;
    expect((await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scId })).body.ok).toBe(true);
    const ok = await rpc(getXuongToken(), 'scSetDeadline', { id: scId, han_tra_xe: '2026-09-15' });
    expect(ok.status).toBe(200);
    expect(ok.body.result).toEqual({ ok: true, han_tra_xe: '2026-09-15' });
    const viaGet = await rpc(getXuongToken(), 'scGet', { id: scId });
    expect(viaGet.body.result.han_tra_xe).toBe('2026-09-15');
    const viaDb = await db.query('SELECT han_tra_xe FROM sc WHERE id=$1', [scId]);
    expect(viaDb.rows[0].han_tra_xe).toBe('2026-09-15');

    // định dạng sai → chặn (v3.6 sc.js:285)
    const badFmt = await rpc(getXuongToken(), 'scSetDeadline', { id: scId, han_tra_xe: '15/09/2026' });
    expect(badFmt.status).toBe(400);
    expect(badFmt.body.error).toContain('YYYY-MM-DD');
    expect((await db.query('SELECT han_tra_xe FROM sc WHERE id=$1', [scId])).rows[0].han_tra_xe)
      .toBe('2026-09-15'); // lỗi không được ghi đè

    // '' = XÓA hẹn (v3.6 String(ngay||''))
    const clear = await rpc(getXuongToken(), 'scSetDeadline', { id: scId, han_tra_xe: '' });
    expect(clear.body.result).toEqual({ ok: true, han_tra_xe: '' });
    // dang_sua vẫn còn hạn: scA đang dang_sua cũng đặt được
    const anyStart = await rpc(getXuongToken(), 'scSetDeadline', { id: scA, han_tra_xe: '2026-10-01' });
    expect(anyStart.body.ok).toBe(true);

    // ROLE: dispatch ['sc','sua'] — ketoan/kho/giamdoc 403 (v3.6 Matrix: xuong/Admin;
    // GHI CHÚ LỆCH v3.6 cho giamdoc đặt hẹn — v5 MATRIX giamdoc KHÔNG có sc.sua → 403)
    for (const tok of [getKetoanToken(), getKhoToken(), getGiamdocToken()]) {
      const denied = await rpc(tok, 'scSetDeadline', { id: scA, han_tra_xe: '2026-11-11' });
      expect(denied.status).toBe(403);
    }
    const anonRes = await anon('scSetDeadline', { id: scA, han_tra_xe: '2026-11-11' });
    expect(anonRes.status).toBe(401);

    // tu_choi chặn tiếp: de_xuat→tu_choi rồi set deadline → lỗi trạng thái
    const scT = await rpc(getXuongToken(), 'scCreate', {
      xe_id: (await rpc(getXuongToken(), 'xeList')).body.result[0].id, ngay: today(),
    });
    const tc = scT.body.result.id as string;
    await rpc(getXuongToken(), 'scTuChoi', { sc_id: tc, ly_do: 'thử chặn deadline' });
    const afterReject = await rpc(getXuongToken(), 'scSetDeadline', { id: tc, han_tra_xe: '2026-09-30' });
    expect(afterReject.status).toBe(400);
    expect(afterReject.body.error).toContain('không đặt được ngày hẹn');
  });

  /* ═══ TC5 — thoList: đúng namespace xuong, deleted bị loại ═══ */
  test('TC5 — thoList: id+name users role=xuong đang sống; deleted_at loại; anon 401', async () => {
    const res = await rpc(getXuongToken(), 'thoList');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const rows = res.body.result as Array<{ id: string; name: string }>;
    const u = rows.find((r) => r.id === 'U-XUONG');
    expect(u).toBeDefined();
    expect(u!.name).toBe('xuong');
    // MỌI dòng trả về đều đúng role trong DB (không lọt admin/kho)
    for (const r of rows) {
      const chk = await db.query("SELECT role FROM users WHERE id=$1", [r.id]);
      expect(chk.rows[0].role).toBe('xuong');
    }
    // thêm 1 xuong đang sống + 1 xuong ĐÃ xóa mềm → chỉ sống xuất hiện
    await db.query(
      "INSERT INTO users (id,name,role,pass_hash,must_change,deleted_at) VALUES ('U-THOTMP','Thợ Test','xuong','x',1,'')"
    );
    await db.query(
      "INSERT INTO users (id,name,role,pass_hash,must_change,deleted_at) VALUES ('U-THODEL','Thợ Xóa','xuong','x',1,$1)",
      [today()],
    );
    try {
      const r2 = await rpc(getKhoToken(), 'thoList'); // META ['sc','xem'] → role kho gọi được
      const ids2 = (r2.body.result as any[]).map((x) => x.id);
      expect(ids2).toContain('U-THOTMP');
      expect(ids2).not.toContain('U-THODEL');
      // anon → 401 (dispatch, không lộ danh sách)
      expect((await anon('thoList')).status).toBe(401);
    } finally {
      await db.query("DELETE FROM users WHERE id IN ('U-THOTMP','U-THODEL')"); // dọn db dùng chung
    }
  });

  /* ═══ TC6 — input gatekeeping: tiền/số lượng âm, id rác ═══ */
  test('TC6 — don_gia/so_luong ÂM bị chặn; id sai format chặn ở core (HTTP không zod)', async () => {
    const scN = await rpc(getAdminToken(), 'scCreate', {
      xe_id: (await rpc(getXuongToken(), 'xeList')).body.result[0].id, ngay: today(),
    });
    const id = scN.body.result.id as string;
    const add = await rpc(getAdminToken(), 'scAddCongViec', { sc_id: id, mo_ta: 'CV', so_luong: 1, don_gia: 10 });
    const line = add.body.result.id as string;

    const neg = await rpc(getAdminToken(), 'scWorkSet', { id: line, don_gia: -5 });
    expect(neg.status).toBe(400);
    expect(neg.body.error).toContain('don_gia');

    const negVt = await rpc(getAdminToken(), 'scAddVatTu', { sc_id: id, vattu_id: 'VT-000001', so_luong: 1, don_gia: -1 });
    expect(negVt.status).toBe(400);

    const longId = await rpc(getAdminToken(), 'scWorkDel', { id: 'CV-00000000000000000000' });
    expect(longId.status).toBe(400);
    expect(longId.body.error).toContain('id');

    const noId = await rpc(getAdminToken(), 'scWorkSet', { don_gia: 5 });
    expect(noId.status).toBe(400); // requireStr 'id'
  });

  test('(K)kill-guard: scWorkSet không cho sửa dòng của phiếu KHÁC qua sc_id giả (sc_id suy từ dòng)', async () => {
    // cv2 thuộc scA; gọi set với payload sc_id lạ KHÔNG có trong args → vẫn ăn đúng phiếu (scA dang_sua)
    // ⇒ gate nhìn trạng thái của phiếu THẬT, không tin client: vẫn 'Chỉ sửa khi đề xuất.'
    const spoof = await rpc(getAdminToken(), 'scWorkSet', { id: cv2, sc_id: 'SC-999999', don_gia: 7 });
    expect(spoof.status).toBe(400);
    expect(spoof.body.error).toBe(GATE_MSG);
    expect(deadlineSc).toBeTruthy(); // scA/scD dang_sua từ TC3/TC4 — ngữ cảnh đúng
  });
});
