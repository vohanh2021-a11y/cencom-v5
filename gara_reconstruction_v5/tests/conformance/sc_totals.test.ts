/**
 * W0.2 — Conformance: tính tổng tiền SC (sc.tong_cong / tong_vt / tong)
 *
 * lib/core/sc.ts: recalcScTotals(scId) — 1 UPDATE atomic, recomputed từ dòng chi tiết,
 * port NGUYÊN công thức v3.6 server/sc.js recalc() dòng 35–46:
 *   tong_cong = SUM(so_luong * don_gia)                            FROM sc_congviec (deleted_at='')
 *   tong_vt   = SUM(so_luong * CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END) FROM sc_vattu (deleted_at='')
 *   tong      = tong_cong + tong_vt
 * Hook: được gọi ở CUỐI scCreate / scAddCongViec / scAddVatTu (sau INSERT).
 *
 * Lưu ý fixture: v5 CHƯA có RPC cập nhật giá dòng vật tư (scAddVatTu chỉ nhận
 * {sc_id, vattu_id, so_luong} → gd_dk INSERT = DEFAULT 0), nên test set gd_dk/gd_tt
 * trực tiếp qua db.query — cùng phong cách insertNhapXuat/TC9 của qc206_hoso.test.ts.
 * Vì recalc là FULL-recompute từ dòng, mỗi lần thêm dòng kế tiếp sẽ quy tụ lại đúng tổng.
 *
 * Số tiền nghiệm thu: 2 CV (10×5=50, 2×100=200) + 2 VT (3×40=120, 1×1000=1000)
 *   → tong_cong=250, tong_vt=1120, tong=1370  ⇒ bước 8 checkHoSo (tong>0) ĐẠT.
 */

import request from 'supertest';
import { getAdminToken, getKhoToken, getGiamdocToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

const today = (): string => new Date().toISOString().split('T')[0];
const num = (v: any): number => Number(v); // pg trả NUMERIC dạng string → ép số

/** Bước 8 — label phát sinh từ lib/core/ho_so.ts (không đổi) */
const LABEL_STEP8 = 'Bảng kê chi tiết (tổng > 0)';

/** Tạo SC bằng admin (⇒ is_test=1 theo scCreate) — không lẫn dữ liệu thật */
async function createTestSc(): Promise<string> {
  const xe = await rpc(getAdminToken(), 'xeList');
  expect(xe.body.ok).toBe(true);
  expect(xe.body.result.length).toBeGreaterThan(0);
  const res = await rpc(getAdminToken(), 'scCreate', { xe_id: xe.body.result[0].id, ngay: today() });
  expect(res.body.ok).toBe(true);
  return res.body.result.id as string;
}

/** Đọc tổng qua RPC scGet (đường khách thật, không đọc DB tay) */
async function scTotals(scId: string): Promise<{ tong_cong: number; tong_vt: number; tong: number }> {
  const res = await rpc(getGiamdocToken(), 'scGet', { id: scId });
  expect(res.body.ok).toBe(true);
  const r = res.body.result;
  expect(r.tong_cong).not.toBeNull();
  expect(r.tong_vt).not.toBeNull();
  expect(r.tong).not.toBeNull();
  return { tong_cong: num(r.tong_cong), tong_vt: num(r.tong_vt), tong: num(r.tong) };
}

async function addVattu(ten: string, gia: number): Promise<string> {
  const res = await rpc(getKhoToken(), 'vattuCreate', { ten, don_vi: 'cái', gia, ton_min: 0 });
  expect(res.body.ok).toBe(true);
  return res.body.result.id as string;
}

/** Gán giá cho dòng sc_vattu vừa INSERT (gd_dk = giá đăng ký/báo giá theo schema.sql) */
async function setLinePrice(vattuLineId: string, gdDk: number, gdTt = 0): Promise<void> {
  await db.query('UPDATE sc_vattu SET gd_dk=$2, gd_tt=$3 WHERE id=$1', [vattuLineId, gdDk, gdTt]);
}

describe('W0.2 — recalc tong_cong/tong_vt/tong SC + bước 8 hồ sơ', () => {
  const cvIds: string[] = [];
  const vtAIds: string[] = [];
  let scMain = '';

  /* ── TC1: scCreate hook → 3 cột 0, không NULL, is_test=1 ───────── */
  test('TC1 — scCreate → tong_cong/tong_vt/tong tồn tại = 0 (is_test SC)', async () => {
    scMain = await createTestSc();
    const db0 = await db.query(
      'SELECT tong_cong, tong_vt, tong, is_test FROM sc WHERE id=$1 AND deleted_at=\'\'', [scMain]);
    expect(db0.rows).toHaveLength(1);
    const r = db0.rows[0];
    expect(Number(r.is_test)).toBe(1);
    expect(num(r.tong_cong)).toBe(0);
    expect(num(r.tong_vt)).toBe(0);
    expect(num(r.tong)).toBe(0);
    expect(await scTotals(scMain)).toEqual({ tong_cong: 0, tong_vt: 0, tong: 0 });
  });

  /* ── TC2: dòng CV price-NULL không đóng góp (SUM bỏ NULL như v3.6) ─ */
  test('TC2 — CV thiếu so_luong/don_gia (NULL) → tổng không đổi (+0)', async () => {
    const res = await rpc(getAdminToken(), 'scAddCongViec', { sc_id: scMain, mo_ta: 'CV chưa báo giá' });
    expect(res.body.ok).toBe(true);
    cvIds.push(res.body.result.id);
    // 0 dòng có giá → tong_cong = 0; tong_vt = 0
    expect(await scTotals(scMain)).toEqual({ tong_cong: 0, tong_vt: 0, tong: 0 });
  });

  /* ── TC3: luồng chuẩn 2 CV + 2 VT → 250 / 1120 / 1370 ───────────── */
  test('TC3 — thêm CV(10×5), CV(2×100) + 2 VT(3×40, 1×1000) → recalc 250/1120/1370', async () => {
    // VT trước, giá set trực tiếp theo fixture-note; mỗi INSERT VT/CV kế tiếp trigger
    // full-recompute nên tổng quy tụ đúng tại thời điểm assert (không cần UPDATE sc tay).
    const vgiaA = await addVattu('W02-VT-A-40', 40);
    const vgiaB = await addVattu('W02-VT-B-1000', 1000);

    const vt1 = await rpc(getAdminToken(), 'scAddVatTu', { sc_id: scMain, vattu_id: vgiaA, so_luong: 3 });
    expect(vt1.body.ok).toBe(true);
    vtAIds.push(vt1.body.result.id);
    await setLinePrice(vt1.body.result.id, 40); // 3×40 = 120

    const vt2 = await rpc(getAdminToken(), 'scAddVatTu', { sc_id: scMain, vattu_id: vgiaB, so_luong: 1 });
    expect(vt2.body.ok).toBe(true);
    vtAIds.push(vt2.body.result.id);
    // recalc lúc này: tong_vt = 3×40 = 120 (dòng A giá đã set), dòng B chưa giá → 0
    expect(await scTotals(scMain)).toEqual({ tong_cong: 0, tong_vt: 120, tong: 120 });
    await setLinePrice(vt2.body.result.id, 1000); // 1×1000

    const cv1 = await rpc(getAdminToken(), 'scAddCongViec', {
      sc_id: scMain, mo_ta: 'CV 10×5', loai_xu_ly: 'sua_chua', so_luong: 10, don_gia: 5,
    });
    expect(cv1.body.ok).toBe(true);
    cvIds.push(cv1.body.result.id);
    // recalc pick-up nốt giá VT B vừa set: tong_vt = 1120, tong_cong = 50
    expect(await scTotals(scMain)).toEqual({ tong_cong: 50, tong_vt: 1120, tong: 1170 });

    const cv2 = await rpc(getAdminToken(), 'scAddCongViec', {
      sc_id: scMain, mo_ta: 'CV 2×100', so_luong: 2, don_gia: 100,
    });
    expect(cv2.body.ok).toBe(true);
    cvIds.push(cv2.body.result.id);

    // ══ nghiệm thu con số task: tong_cong=250 (50+200), tong_vt=1120 (120+1000), tong=1370 ══
    expect(await scTotals(scMain)).toEqual({ tong_cong: 250, tong_vt: 1120, tong: 1370 });
  });

  /* ── TC4: "Thêm 1 CV → tăng đúng" ───────────────────────────────── */
  test('TC4 — thêm 1 CV nữa (5×50=250) → tong_cong/tong tăng đúng (vt giữ nguyên)', async () => {
    const cv3 = await rpc(getAdminToken(), 'scAddCongViec', {
      sc_id: scMain, mo_ta: 'CV 5×50', so_luong: 5, don_gia: 50,
    });
    expect(cv3.body.ok).toBe(true);
    cvIds.push(cv3.body.result.id);
    expect(await scTotals(scMain)).toEqual({ tong_cong: 500, tong_vt: 1120, tong: 1620 });
  });

  /* ── TC5: gd_tt>0 được ưu tiên hơn gd_dk (CASE v3.6) ───────────── */
  test('TC5 — giá quyết toán gd_tt>0 override gd_dk khi recalc', async () => {
    // dòng vt1 (3 × gd_dk=40 =120) → set gd_tt=45 (giá sau nghiệm thu) → phải thành 135 (+15)
    await db.query('UPDATE sc_vattu SET gd_tt=45 WHERE id=$1', [vtAIds[0]]);
    // trigger recalc bằng hành động public (thêm VT giá 0, đóng góp 0):
    const vzero = await addVattu('W02-VT-ZERO', 0);
    const vt3 = await rpc(getAdminToken(), 'scAddVatTu', { sc_id: scMain, vattu_id: vzero, so_luong: 2 });
    expect(vt3.body.ok).toBe(true);
    vtAIds.push(vt3.body.result.id); // gd_dk default 0 → 2×0=0
    // tong_vt = 3×45(gd_tt) + 1×1000 + 2×0 = 1135 ; tong_cong giữ 500
    expect(await scTotals(scMain)).toEqual({ tong_cong: 500, tong_vt: 1135, tong: 1635 });
  });

  /* ── TC6: soft-delete dòng → loại khỏi tổng (WHERE deleted_at='') ─ */
  test('TC6 — xoá mềm dòng CV/VT → recalc lần sau loại khỏi tổng', async () => {
    // soft-delete CV(2×100=200) + VT dòng gd_tt=45 (=135) qua DB (chưa có RPC delete)
    //   cvIds = [cNull, c10x5, c2x100, c5x50] → index 2 là dòng 2×100 cần xoá
    await db.query('UPDATE sc_congviec SET deleted_at=$2 WHERE id=$1', [cvIds[2], today()]);
    await db.query('UPDATE sc_vattu SET deleted_at=$2 WHERE id=$1', [vtAIds[0], today()]);
    // trigger: thêm CV giá 0 × 0đ
    const cv4 = await rpc(getAdminToken(), 'scAddCongViec', {
      sc_id: scMain, mo_ta: 'CV trigger soft-delete', so_luong: 1, don_gia: 0,
    });
    expect(cv4.body.ok).toBe(true);
    cvIds.push(cv4.body.result.id);
    // cv còn: 10×5=50 + 5×50=250 + 1×0=0 → 300 ; vt còn: 1×1000 + 2×0 → 1000 ; tong 1300
    expect(await scTotals(scMain)).toEqual({ tong_cong: 300, tong_vt: 1000, tong: 1300 });
  });

  /* ── TC7: bước 8 hồ sơ QC206 — tong>0 → ĐẠT, SC rỗng → fail ─────── */
  test('TC7 — hoSoCheck bước 8: SC có tiền → ĐẠT (miss không còn label bước 8)', async () => {
    const res = await rpc(getGiamdocToken(), 'hoSoCheck', { sc_id: scMain });
    expect(res.body.ok).toBe(true);
    const s8 = res.body.result.steps.find((s: any) => s.step === 8);
    expect(s8).toBeDefined();
    expect(s8.ok).toBe(true); // tong = 1300 > 0
    expect(res.body.result.miss).not.toContain(LABEL_STEP8);

    // control: SC mới chưa có dòng → bước 8 PHẢI fail và miss chứa label
    const empty = await createTestSc();
    const res0 = await rpc(getGiamdocToken(), 'hoSoCheck', { sc_id: empty });
    expect(res0.body.ok).toBe(true);
    const s8empty = res0.body.result.steps.find((s: any) => s.step === 8);
    expect(s8empty.ok).toBe(false);
    expect(res0.body.result.miss).toContain(LABEL_STEP8);
  });

  /* ── TC8: độc lập SC — thao tác SC B không đụng tổng SC A ───────── */
  test('TC8 — recalc chỉ tính dòng của đúng sc_id (không lẫn SC khác)', async () => {
    const before = await scTotals(scMain);
    const scB = await createTestSc();
    const cvB = await rpc(getAdminToken(), 'scAddCongViec', {
      sc_id: scB, mo_ta: 'CV của SC B', so_luong: 1, don_gia: 999,
    });
    expect(cvB.body.ok).toBe(true);
    expect(await scTotals(scB)).toEqual({ tong_cong: 999, tong_vt: 0, tong: 999 });
    expect(await scTotals(scMain)).toEqual(before);
  });
});
