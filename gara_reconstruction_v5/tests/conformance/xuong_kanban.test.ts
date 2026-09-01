/**
 * W3.1-core — Conformance: lib/core/xuong.ts `dashboardAll` (kanban 5 cột + KPI).
 * Port v3.6 server/xuong.js dashboardAll (dòng 119–294) sang schema v5.
 *
 * Phong cách: gọi HÀM CORE TRỰC TIẾP qua buildApi + db (pattern kho_tonkho /
 * kho_cuhong — KHÔNG HTTP, không cần :3000 vì stdio).
 *
 * Fixture is_test=0:
 *  - SC: scCreate role 'xuong' (sc.ts: chỉ admin mới gắn is_test=1).
 *  - XE: core xeCreate CHỈ admin có quyền (MATRIX) → admin-insert sẽ is_test=1,
 *    không vào dashboard (lọc is_test=0 như tonKho/xeList) ⇒ INSERT xe trực tiếp
 *    qua db.query với is_test=0 + MARK 'W31' (cùng phong cách setLinePrice của
 *    sc_totals.test.ts).
 *  - Đổi tt công việc → 'hoan': scAddCongViec không nhận tt (default 'cho') →
 *    UPDATE trực tiếp (sc_totals đã set giá dòng bằng cách tương tự).
 *  - Quyết toán: scQuyetToanRequires gate hồ sơ 8 bước (ngoài phạm vi file này)
 *    → mô phỏng ĐÚNG hiệu ứng của nó: UPDATE trang_thai='da_quyet' + INSERT
 *    dòng activity_log hanh_dong='sc_quyet_toan' (nguồn dữ liệu KPI v5 đọc).
 *
 * KPI assert theo CẶP ĐỒNG THỜI: dashboardAll vs SELECT đếm độc lập cùng công
 * thức (an toàn khi DB có fixture của suite khác — runInBand tuần tự).
 */
import { buildApi } from '../../lib/api';
import { db, nextId } from '../../lib/db';
import {
  scCreate, scAddCongViec, scBatDauSua, scHoanThanh, scTuChoi,
} from '../../lib/core/sc';
import { vattuCreate, dmCreate } from '../../lib/core/kho';
import { dashboardAll, vnd } from '../../lib/core/xuong';

const apiXuong = buildApi({ id: 'U-XUONG', name: 'xuong', role: 'xuong' });
const apiKetoan = buildApi({ id: 'U-KETOAN', name: 'ketoan', role: 'ketoan' });
const apiAdmin = buildApi({ id: 'U-ADMIN', name: 'admin', role: 'admin' });
const apiKho = buildApi({ id: 'U-KHO', name: 'kho', role: 'kho' });
const apiAnon = buildApi(null);

const today = () => new Date().toISOString().split('T')[0];
const yesterday = () => new Date(Date.now() - 86400000).toISOString().split('T')[0];
const MARK = 'W31';

/** Guard envelope + trả result (fail sớm với message đọc được). */
async function dash(api: ReturnType<typeof buildApi>) {
  const r = await dashboardAll(api);
  expect(r.ok).toBe(true);
  return r.result!;
}

/** Tạo xe is_test=0 trực tiếp (xeCreate core chỉ admin ⇒ sẽ is_test=1). */
async function mkXe(hieu: string): Promise<string> {
  const id = await nextId('XE');
  await db.query(
    "INSERT INTO xe (id, bien_so, chu_xe, nam_sx, nguyen_gia, is_test, deleted_at) VALUES ($1,$2,$3,2020,0,0,'')",
    [id, `${MARK}${hieu}`, 'Chủ W31']
  );
  createdXe.push(id);
  return id;
}

/** SC của xe (role xuong → is_test=0, trạng thái khởi đầu de_xuat). */
async function mkSc(xeId: string): Promise<string> {
  const r = await scCreate(apiXuong, { xe_id: xeId, ngay: today() });
  createdSc.push(r.id);
  return r.id;
}

function findCard(res: Awaited<ReturnType<typeof dash>>, xeId: string) {
  return res.kanban.cols.flatMap((c) => c.cards).find((x) => x.xe_id === xeId);
}

/** Mirror SELECT đếm SC active is_test=0 ĐỘC LẬP với core (cùng bộ lọc). */
async function scMirrorCounts() {
  const r = await db.query(
    "SELECT COUNT(*) FILTER (WHERE trang_thai='de_xuat')::int AS de_xuat, " +
    "       COUNT(*) FILTER (WHERE trang_thai='dang_sua')::int AS dang_sua, " +
    "       COUNT(*) FILTER (WHERE trang_thai='da_hoan')::int  AS da_hoan " +
    "FROM sc WHERE deleted_at='' AND is_test=0"
  );
  return r.rows[0];
}

/** Mirror KPI quyết-toán-hôm-nay (cửa sổ ngày UTC — copy công thức core). */
async function quyetTodayMirror(): Promise<{ n: number; tien: number }> {
  const r = await db.query(
    'SELECT COUNT(*)::int n, COALESCE(SUM(tong),0)::float8 tien FROM (' +
    '  SELECT DISTINCT s.id, s.tong FROM activity_log a JOIN sc s ON s.id=a.sc_id' +
    "  WHERE a.hanh_dong='sc_quyet_toan' AND a.is_test=0" +
    "    AND s.trang_thai='da_quyet' AND s.deleted_at='' AND s.is_test=0" +
    "    AND a.ts >= ($1::timestamp AT TIME ZONE 'UTC')" +
    "    AND a.ts <  ($1::timestamp AT TIME ZONE 'UTC') + INTERVAL '24 hours') d",
    [today() + 'T00:00:00']
  );
  const x = r.rows[0];
  return { n: Number(x.n), tien: Number(x.tien) };
}

const createdXe: string[] = [];
const createdSc: string[] = [];
const createdVt: string[] = [];
const createdDm: string[] = [];

jest.setTimeout(60000);

afterAll(async () => {
  // Soft-delete theo chuẩn v5 (không DELETE cứng). activity_log là audit —
  // KHÔNG có deleted_at, các dòng ghi test để lại là hành vi đúng của log.
  if (createdSc.length) {
    await db.query("UPDATE sc SET deleted_at=$2 WHERE id=ANY($1::text[])", [createdSc, today()]);
    await db.query("UPDATE sc_congviec SET deleted_at=$2 WHERE sc_id=ANY($1::text[])", [createdSc, today()]);
  }
  if (createdXe.length) await db.query("UPDATE xe SET deleted_at=$1 WHERE id=ANY($2::text[])", [today(), createdXe]);
  if (createdVt.length) await db.query("UPDATE vattu SET deleted_at=$1 WHERE id=ANY($2::text[])", [today(), createdVt]);
  if (createdDm.length) await db.query("UPDATE dm SET deleted_at=$1 WHERE id=ANY($2::text[])", [today(), createdDm]);
});

describe('W3.1 — xuong.dashboardAll: kanban 5 cột v5 + KPI an toàn schema (core trực tiếp)', () => {
  let xeA = ''; let scA1 = ''; let scA2 = '';
  let xeB = ''; let scB1 = ''; let scB2 = '';
  let xeC = ''; let scC = '';

  /* ── TC1: cổng quyền — 401 ẩn danh; 403 ketoan (chặn cứng v3.6); xuong OK ── */
  test('TC1 — anon→401, ketoan→403 (port chặn cứng), xuong→ok + đúng khung 5 cột', async () => {
    const anon = await dashboardAll(apiAnon);
    expect(anon).toEqual({ ok: false, error: '401' });

    const kt = await dashboardAll(apiKetoan);
    expect(kt).toEqual({ ok: false, error: '403' });

    const res = await dash(apiXuong);
    // enum v5 THẬT (schema.sql CHECK): không còn da_duyet/cho_nghiem
    expect(res.kanban.cols.map((c) => c.key)).toEqual(
      ['de_xuat', 'dang_sua', 'da_hoan', 'da_quyet', 'tu_choi']
    );
    expect(res.kanban.cols.map((c) => c.label)).toEqual(
      ['Đề xuất', 'Đang sửa', 'Chờ nghiệm thu', 'Đã quyết toán', 'Từ chối']
    );
    expect(res.today).toBe(today());
    // KPI đủ bộ v5-safe; chat_unread/tk_* đã BỎ
    expect(Object.keys(res.kpi).sort()).toEqual(
      ['dm_cho_duyet', 'hoat_dong_24h', 'sc_cho_duyet', 'sc_cho_nghiem', 'sc_dang_sua',
        'sc_quyet_hom_nay', 'tien_quyet_hom_nay', 'vattu_thieu', 'vattu_thieu_items', 'xe'].sort()
    );
    expect(typeof res.kpi.tien_quyet_hom_nay).toBe('string');
    expect(Array.isArray(res.kanban.vehicles)).toBe(true);
  });

  /* ── TC2: 1 xe 2 SC (de_xuat + dang_sua) → về CỘT dang_sua, gộp sc_ids/tiền ── */
  test('TC2 — gộp theo xe: 2 SC 2 trạng thái → 1 card cột cao nhất, cộng tiền + % theo SC đỉnh', async () => {
    xeA = await mkXe('XE-A');
    scA1 = await mkSc(xeA);                       // de_xuat
    scA2 = await mkSc(xeA);                       // de_xuat
    await scBatDauSua(apiXuong, { sc_id: scA2 }); // → dang_sua
    const cv1 = await scAddCongViec(apiXuong, { sc_id: scA2, mo_ta: 'W31 cv1', so_luong: 10, don_gia: 5 });   // 50
    const cv2 = await scAddCongViec(apiXuong, { sc_id: scA2, mo_ta: 'W31 cv2', so_luong: 1, don_gia: 100 });  // 100
    await db.query("UPDATE sc_congviec SET tt='hoan' WHERE id=$1", [cv1.id]); // 1/2 hoan → 50%

    const res = await dash(apiXuong);
    const colDS = res.kanban.cols.find((c) => c.key === 'dang_sua')!;
    const card = colDS.cards.find((c) => c.xe_id === xeA);
    expect(card).toBeDefined();
    expect(card!.sc_ids).toEqual([scA1, scA2]); // gộp NHẰNG bien_so/xe, nhớ ASC ngay/id
    expect(card!.sc_count).toBe(2);
    expect(card!.primary_state).toBe('dang_sua');
    expect(card!.bien_so).toBe(`${MARK}XE-A`);
    expect(card!.tong_tien).toBe(150);
    expect(card!.tong_tien_vnd).toBe(vnd(150));
    expect(card!.state_counts).toMatchObject({ de_xuat: 1, dang_sua: 1 });
    // % theo SC ĐỈNH (dang_sua=scA2) — công thức v3.6 dòng 196–198
    expect(card!.so_cv).toBe(2);
    expect(card!.so_cv_hoan).toBe(1);
    expect(card!.phan_tram).toBe(50);
    // sc_details: cả 2 SC, SC de_xuat 0 cv → 0%
    expect(card!.sc_details.map((d) => d.id)).toEqual([scA1, scA2]);
    expect(card!.sc_details[0].so_cv).toBe(0);
    expect((card!.sc_details[0] as any).phan_tram === undefined).toBe(true); // % chỉ ở card
    expect(card!.sc_details[1].so_cv_hoan).toBe(1);
    // phương tiện flat: xe xuất hiện ĐÚNG 1 lần
    expect(res.kanban.vehicles.filter((v) => v.xe_id === xeA)).toHaveLength(1);
    // không leak cột khác
    for (const c of res.kanban.cols.filter((c) => c.key !== 'dang_sua')) {
      expect(c.cards.some((k) => k.xe_id === xeA)).toBe(false);
    }
  });

  /* ── TC3: STATE_PRI port — tu_choi bét, de_xuat xếp TRƯỚC tu_choi ── */
  test('TC3 — từ chối 1 mình→cột tu_choi; thêm SC de_xuat→card về de_xuat (pri 2>1)', async () => {
    xeB = await mkXe('XE-B');
    scB1 = await mkSc(xeB);
    await scTuChoi(apiXuong, { sc_id: scB1, ly_do: 'W31 từ chối' });

    let res = await dash(apiXuong);
    let card = findCard(res, xeB)!;
    expect(card.primary_state).toBe('tu_choi');
    expect(res.kanban.cols.find((c) => c.key === 'tu_choi')!.cards.map((c) => c.xe_id)).toContain(xeB);

    scB2 = await mkSc(xeB); // de_xuat mới
    res = await dash(apiXuong);
    card = findCard(res, xeB)!;
    expect(card.primary_state).toBe('de_xuat');          // PRIORITY_ORDER: de_xuat trước tu_choi
    expect(card.sc_ids).toEqual([scB1, scB2]);           // vẫn ASC theo id (ngay bằng nhau)
    expect(card.state_counts).toMatchObject({ de_xuat: 1, tu_choi: 1 });
    expect(res.kanban.cols.find((c) => c.key === 'tu_choi')!.cards.some((c) => c.xe_id === xeB)).toBe(false);
  });

  /* ── TC4: KPI đếm = SELECT đếm độc lập (cùng cửa sổ gọi, is_test=0, del=0) ── */
  test('TC4 — kpi.sc_cho_duyet/sc_dang_sua/sc_cho_nghiem/xe khớp mirror SQL', async () => {
    xeC = await mkXe('XE-C');
    scC = await mkSc(xeC);
    await scAddCongViec(apiXuong, { sc_id: scC, mo_ta: 'W31 cvC', so_luong: 2, don_gia: 500 }); // tong=1000 (dùng ở TC5)
    await scBatDauSua(apiXuong, { sc_id: scC });
    await scHoanThanh(apiXuong, { sc_id: scC }); // → da_hoan = cột 'Chờ nghiệm thu' v5

    const mirror = await scMirrorCounts();
    const xeCnt = await db.query("SELECT COUNT(*)::int n FROM xe WHERE deleted_at='' AND is_test=0");
    const res = await dash(apiXuong);
    expect(res.kpi.sc_cho_duyet).toBe(Number(mirror.de_xuat));
    expect(res.kpi.sc_dang_sua).toBe(Number(mirror.dang_sua));
    expect(res.kpi.sc_cho_nghiem).toBe(Number(mirror.da_hoan));
    expect(res.kpi.xe).toBe(Number(xeCnt.rows[0].n));
    // card scC nằm cột da_hoan
    expect(findCard(res, xeC)!.primary_state).toBe('da_hoan');
  });

  /* ── TC5: quyết toán hôm nay qua activity (nguồn v5 — không có cột ngày) ── */
  test('TC5 — quyet_hom_nay: activity hôm nay đếm+tiền (+delta), hôm qua KHÔNG đếm (control)', async () => {
    const before = await quyetTodayMirror();
    // mô phỏng hiệu ứng scQuyetToan: đổi trạng thái + log 'sc_quyet_toan' (ts=now())
    await db.query("UPDATE sc SET trang_thai='da_quyet' WHERE id=$1", [scC]);
    await db.query(
      "INSERT INTO activity_log (actor_id,actor_role,hanh_dong,doi_tuong,doi_tuong_id,sc_id,mo_ta,is_test) " +
      "VALUES ('U-KETOAN','ketoan','sc_quyet_toan','sc',$1,$1,'W31 qt hôm nay',0)",
      [scC]
    );
    const res = await dash(apiXuong);
    expect(res.kpi.sc_quyet_hom_nay).toBe(before.n + 1);
    expect(res.kpi.tien_quyet_hom_nay).toBe(vnd(before.tien + 1000));
    expect(findCard(res, xeC)!.primary_state).toBe('da_quyet'); // lên cột 'Đã quyết toán'

    // CONTROL: xeE da_quyet nhưng activity HÔM QUA → không vào KPI 'hôm nay'
    const xeE = await mkXe('XE-E');
    const scE = await mkSc(xeE);
    await db.query("UPDATE sc SET trang_thai='da_quyet' WHERE id=$1", [scE]);
    await db.query(
      "INSERT INTO activity_log (actor_id,actor_role,hanh_dong,doi_tuong,doi_tuong_id,sc_id,mo_ta,is_test,ts) " +
      "VALUES ('U-KETOAN','ketoan','sc_quyet_toan','sc',$1,$1,'W31 qt hôm qua',0," +
      "  ($2::timestamp AT TIME ZONE 'UTC') + INTERVAL '12 hours')",
      [scE, yesterday() + 'T00:00:00']
    );
    const after = await quyetTodayMirror();
    const res2 = await dash(apiXuong);
    expect(res2.kpi.sc_quyet_hom_nay).toBe(after.n);   // scE không cộng thêm
    expect(res2.kpi.tien_quyet_hom_nay).toBe(vnd(after.tien));
    expect(findCard(res2, xeE)!.primary_state).toBe('da_quyet');
  });

  /* ── TC6: is_test=1 (admin tạo) KHÔNG lẫn vào dashboard (pattern tonKho) ── */
  test('TC6 — scCreate admin (is_test=1) → không vào kanban/KPI; dữ liệu thật vẫn khớp mirror', async () => {
    const mk = await scCreate(apiAdmin, { xe_id: xeA, ngay: today() }); // admin ⇒ is_test=1
    const check = await db.query('SELECT is_test, trang_thai FROM sc WHERE id=$1', [mk.id]);
    expect(Number(check.rows[0].is_test)).toBe(1);
    expect(check.rows[0].trang_thai).toBe('de_xuat');

    const res = await dash(apiXuong);
    const cardA = findCard(res, xeA)!;
    expect(cardA.sc_count).toBe(2);           // không nhận SC is_test=1
    expect(cardA.sc_ids).not.toContain(mk.id);
    for (const v of res.kanban.vehicles) expect(v.sc_ids).not.toContain(mk.id);
    // KPI vẫn = mirror (mirror cũng excludes is_test=1) — chống cả hai phía cùng lệch
    const mirror = await scMirrorCounts();
    expect(res.kpi.sc_cho_duyet).toBe(Number(mirror.de_xuat));
    // de_xuat tăng thêm 1 dòng is_test=1 NHƯNG mirror cũng lọc → bất biến hold;
    // bằng chứng phụ: đếm KHÔNG lọc is_test phải LỚN hơn kpi
    const loose = await db.query("SELECT COUNT(*)::int n FROM sc WHERE deleted_at='' AND trang_thai='de_xuat'");
    expect(Number(loose.rows[0].n)).toBeGreaterThan(res.kpi.sc_cho_duyet);
  });

  /* ── TC7: soft-delete loại khỏi Kanban + KPI ── */
  test('TC7 — deleted_at≠∅ → card biến mất, KPI khớp mirror sau xoá mềm', async () => {
    const xeG = await mkXe('XE-G');
    const scG = await mkSc(xeG); // de_xuat
    expect(findCard(await dash(apiXuong), xeG)).toBeDefined();

    await db.query('UPDATE sc SET deleted_at=$2 WHERE id=$1', [scG, today()]);
    const res = await dash(apiXuong);
    expect(findCard(res, xeG)).toBeUndefined();
    expect(res.kanban.vehicles.some((v) => v.xe_id === xeG)).toBe(false);
    const mirror = await scMirrorCounts();
    expect(res.kpi.sc_cho_duyet).toBe(Number(mirror.de_xuat));
  });

  /* ── TC8: vattu_thieu + dm_cho_duyet — import core kho.ts TRỰC TIẾP ── */
  test('TC8 — KPI vt thiếu khớp tonKho/SELECT (top10, thieu=ton−ton_min ÂM) + dm cho_duyet = total', async () => {
    const vt = await vattuCreate(apiKho, { ten: `${MARK}-VT-thieu`, don_vi: 'cái', gia: 1000, ton_min: 5 });
    createdVt.push(vt.id); // ton default 0 → 0 < 5 ⇒ low
    const dm = await dmCreate(apiKho, { items: [{ vattu_id: vt.id, so_luong: 2, don_gia: 500 }], ngay: today() });
    createdDm.push(dm.id); // trạng thái khởi đầu cho_duyet, is_test=0 (role kho)

    const lowCnt = await db.query(
      "SELECT COUNT(*)::int n FROM vattu WHERE deleted_at='' AND is_test=0 AND ton < ton_min"
    );
    const dmCnt = await db.query(
      "SELECT COUNT(*)::int n FROM dm WHERE deleted_at='' AND is_test=0 AND trang_thai='cho_duyet'"
    );
    const res = await dash(apiXuong);
    expect(res.kpi.vattu_thieu).toBe(Number(lowCnt.rows[0].n));
    expect(res.kpi.dm_cho_duyet).toBe(Number(dmCnt.rows[0].n));
    // items top-10: có mặt vt vừa tạo; quy ước v5 thieu = ton − ton_min (ÂM khi thiếu)
    expect(res.kpi.vattu_thieu_items.length).toBeLessThanOrEqual(10);
    const mine = res.kpi.vattu_thieu_items.find((i: any) => i.id === vt.id);
    expect(mine).toBeDefined();
    expect(mine.thieu).toBe(-5);
    expect(mine.low).toBe(true);
    // 24h hoạt động: KPI kiểu delta-free → chỉ cần là số nguyên ≥ 0 (các TC đã
    // phát sinh activity is_test=0 hôm nay feed vào activityLogCount 24h).
    expect(Number.isInteger(res.kpi.hoat_dong_24h)).toBe(true);
    expect(res.kpi.hoat_dong_24h).toBeGreaterThanOrEqual(0);
  });
});
