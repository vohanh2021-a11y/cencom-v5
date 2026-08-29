/**
 * ho_so.test.ts — UNIT TEST cho logic cốt lõi "Hồ sơ 8 bước" (GPS GĐ2)
 *
 * Kiểm tra:
 *  - checkHoSo() trả về 8 bước đúng cấu trúc + link
 *  - Mỗi bước cập nhật ok=true khi có dữ liệu
 *  - Perm check (403) khi actor thiếu quyền
 *  - nextId đúng prefix
 *  - SC không tồn tại → throw
 *
 * KHÔNG sửa lib — chỉ test.
 */
import request from 'supertest';
import { getAdminToken, getKetoanToken, getKhoToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE)
    .post('/api/rpc')
    .set('Cookie', [`sid=${token}`])
    .send({ fn, args });

/* ─── Helpers ─────────────────────────────────────────── */

async function createSc(): Promise<string> {
  // Lay xe_id hop le tu seed data
  const xeRes = await rpc(getAdminToken(), 'xeList');
  expect(xeRes.body.ok).toBe(true);
  expect(xeRes.body.result.length).toBeGreaterThan(0);
  const xeId = xeRes.body.result[0].id;

  const res = await rpc(getAdminToken(), 'scCreate', {
    xe_id: xeId,
    ngay: new Date().toISOString().split('T')[0],
  });
  expect(res.body.ok).toBe(true);
  expect(res.body.result.id).toMatch(/^SC-\d{6}$/);
  return res.body.result.id;
}

/**
 * Lay ket qua checkHoSo cho 1 SC
 */
async function check(scId: string, token?: string) {
  const res = await rpc(token || getAdminToken(), 'hoSoCheck', { sc_id: scId });
  expect(res.body.ok).toBe(true);
  return res.body.result;
}

/**
 * Duyet cac buoc tra ve
 */
function findStep(steps: any[], step: number) {
  return steps.find((s: any) => s.step === step);
}

/* ─── Cleanup ─────────────────────────────────────────── */

afterAll(async () => {
  // Xoa du lieu test (is_test=1) — thu tu dung FK
  // activity_log co the co dong is_test=0 (logActivity khong luon truyen is_test)
  // nen xoa theo sc_id lien ket truoc
  await db.query(
    'DELETE FROM activity_log WHERE sc_id IN (SELECT id FROM sc WHERE is_test = 1)'
  );
  await db.query('DELETE FROM bao_gia_ncc WHERE is_test = 1');
  await db.query(
    "DELETE FROM baogia_chitiet WHERE baogia_id IN (SELECT id FROM baogia WHERE is_test = 1)"
  );
  await db.query('DELETE FROM baogia WHERE is_test = 1');
  await db.query('DELETE FROM bien_ban_nghiem WHERE is_test = 1');
  await db.query('DELETE FROM phieu_kiem_tu WHERE is_test = 1');
  await db.query('DELETE FROM ke_hoach_sc WHERE is_test = 1');
  await db.query('DELETE FROM ho_so WHERE is_test = 1');
  await db.query('DELETE FROM sc WHERE is_test = 1');
  console.log('✅ Cleanup: du lieu test da xoa');
});

/* ═══════════════════════════════════════════════════════════
   TEST SUITE — Ho so 8 buoc
   ═══════════════════════════════════════════════════════════ */

describe('Ho so 8 buoc — checkHoSo', () => {
  // ── Case 1: Cau truc tra ve ──────────────────────────
  test('1. checkHoSo tra ve steps la mang 8 phan tu, dung thu tu, moi buoc co {step, label, ok, note, link}', async () => {
    const scId = await createSc();
    const result = await check(scId);

    // Co 8 buoc
    expect(result.steps).toBeDefined();
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps).toHaveLength(8);

    // Dung thu tu 1..8
    const stepNums = result.steps.map((s: any) => s.step);
    expect(stepNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // Moi buoc co day du thuoc tinh can thiet
    for (const s of result.steps) {
      expect(s).toHaveProperty('step');
      expect(typeof s.step).toBe('number');
      expect(s).toHaveProperty('label');
      expect(typeof s.label).toBe('string');
      expect(s).toHaveProperty('ok');
      expect(typeof s.ok).toBe('boolean');
      expect(s).toHaveProperty('note');
    }
  });

  // ── Case 1b: Link dung ────────────────────────────────
  test('2. Link dung cho tung buoc: kh, kt, /baogia, /kho/nhap, /kho/xuat, (none), nn, (none)', async () => {
    const scId = await createSc();
    const result = await check(scId);
    const steps = result.steps;

    // Step 1 -> link = 'kh' (scroll)
    expect(findStep(steps, 1)!.link).toBe('kh');
    // Step 2 -> link = 'kt' (scroll)
    expect(findStep(steps, 2)!.link).toBe('kt');
    // Step 3 -> link = '/baogia'
    expect(findStep(steps, 3)!.link).toBe('/baogia');
    // Step 4 -> link = '/kho/nhap'
    expect(findStep(steps, 4)!.link).toBe('/kho/nhap');
    // Step 5 -> link = '/kho/xuat'
    expect(findStep(steps, 5)!.link).toBe('/kho/xuat');
    // Step 6 -> khong bat buoc, khong co link
    expect(findStep(steps, 6)!.link).toBeUndefined();
    // Step 7 -> link = 'nn' (scroll)
    expect(findStep(steps, 7)!.link).toBe('nn');
    // Step 8 -> khong co link
    expect(findStep(steps, 8)!.link).toBeUndefined();
  });

  // ── Case 2: SC moi chua co du lieu → miss ────────────
  test('3. SC moi (is_test, chua du lieu): ok=false, miss chua 7 buoc thieu, step6 luon dat', async () => {
    const scId = await createSc();
    const result = await check(scId);

    // Chua co du lieu gi → ok = false
    expect(result.ok).toBe(false);

    // Step 6 luon dat (non-blocking)
    expect(findStep(result.steps, 6)!.ok).toBe(true);

    // Miss chua cac buoc blocking chua dat (1,2,3,4,5,7,8 = 7 buoc)
    expect(Array.isArray(result.miss)).toBe(true);
    expect(result.miss.length).toBe(7);

    // Moi buoc 1-5,7,8 deu khong ok
    for (const stepNum of [1, 2, 3, 4, 5, 7, 8]) {
      expect(findStep(result.steps, stepNum)!.ok).toBe(false);
    }
  });

  // ── Case 3: keHoachSave → step1 ok ───────────────────
  test('4. keHoachSave tao ke_hoach_sc → step1 ok=true', async () => {
    const scId = await createSc();

    // Luu ke hoach
    const saveRes = await rpc(getAdminToken(), 'keHoachSave', {
      sc_id: scId,
      mo_ta: 'Ke hoach sua chua test',
    });
    expect(saveRes.body.ok).toBe(true);

    // Kiem tra step1
    const result = await check(scId);
    expect(findStep(result.steps, 1)!.ok).toBe(true);

    // Kiem tra DB co dong moi
    const row = await db.query(
      'SELECT id FROM ke_hoach_sc WHERE sc_id=$1 AND deleted_at=$2',
      [scId, '']
    );
    expect(row.rows.length).toBe(1);
  });

  // ── Case 4: kiemTuSave → step2 ok ────────────────────
  test('5. kiemTuSave tao phieu_kiem_tu → step2 ok=true', async () => {
    const scId = await createSc();

    const saveRes = await rpc(getAdminToken(), 'kiemTuSave', {
      sc_id: scId,
      mo_ta: 'Phieu kiem tu test',
    });
    expect(saveRes.body.ok).toBe(true);

    const result = await check(scId);
    expect(findStep(result.steps, 2)!.ok).toBe(true);

    // DB verify
    const row = await db.query(
      'SELECT id FROM phieu_kiem_tu WHERE sc_id=$1 AND deleted_at=$2',
      [scId, '']
    );
    expect(row.rows.length).toBe(1);
  });

  // ── Case 5: nghiemThuSave → step7 ok ─────────────────
  test('6. nghiemThuSave tao bien_ban_nghiem → step7 ok=true', async () => {
    const scId = await createSc();

    const saveRes = await rpc(getAdminToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: '2026-08-29',
      tong_vat_tu: 500000,
      tong_nhan_cong: 200000,
    });
    expect(saveRes.body.ok).toBe(true);

    const result = await check(scId);
    expect(findStep(result.steps, 7)!.ok).toBe(true);

    // DB verify
    const row = await db.query(
      'SELECT id FROM bien_ban_nghiem WHERE sc_id=$1 AND deleted_at=$2',
      [scId, '']
    );
    expect(row.rows.length).toBe(1);
  });

  // ── Case 6: baogiaSave → mirror bao_gia_ncc → step3 ok
  test('7. baogiaSave voi sc_id hop le → mirror bao_gia_ncc (ocr_xac_nhan=1) → step3 ok=true', async () => {
    const scId = await createSc();

    // Luu bao gia
    const saveRes = await rpc(getAdminToken(), 'baogiaSave', {
      sc_id: scId,
      ncc: 'NCC Test GPS',
      ngay: '2026-08-29',
      items: [{ ten: 'Phu tung A', so_luong: 2, don_gia: 150000 }],
    });
    expect(saveRes.body.ok).toBe(true);
    expect(saveRes.body.result.id).toMatch(/^BG-\d{6}$/);

    // Verify mirror: bao_gia_ncc co 1 dong voi ocr_xac_nhan=1
    const mirror = await db.query(
      'SELECT * FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at=$2 AND ocr_xac_nhan=1',
      [scId, '']
    );
    expect(mirror.rows.length).toBe(1);
    expect(Number(mirror.rows[0].tong)).toBe(300000); // 2 * 150000

    // Verify step3
    const result = await check(scId);
    expect(findStep(result.steps, 3)!.ok).toBe(true);
    expect(findStep(result.steps, 3)!.note).toBe('Có báo giá NCC xác nhận');
  });

  // ── Case 7a: keHoachSave + ketoan (thieu sc.sua) → 403
  test('8. keHoachSave voi actor ketoan (thieu quyen sc.sua) → 403', async () => {
    const scId = await createSc();
    const res = await rpc(getKetoanToken(), 'keHoachSave', {
      sc_id: scId,
      mo_ta: 'Test perm',
    });
    expect(res.body.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  // ── Case 7b: kiemTuSave + ketoan (thieu sc.sua) → 403
  test('9. kiemTuSave voi actor ketoan (thieu quyen sc.sua) → 403', async () => {
    const scId = await createSc();
    const res = await rpc(getKetoanToken(), 'kiemTuSave', {
      sc_id: scId,
      mo_ta: 'Test perm',
    });
    expect(res.body.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  // ── Case 7c: nghiemThuSave + kho (thieu sc.kehoach) → 403
  test('10. nghiemThuSave voi actor kho (thieu quyen sc.kehoach) → 403', async () => {
    const scId = await createSc();
    const res = await rpc(getKhoToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: '2026-08-29',
    });
    expect(res.body.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  // ── Case 8: keHoachSave voi sc_id khong ton tai ──────
  test('11. keHoachSave voi sc_id khong ton tai → throw/400', async () => {
    const res = await rpc(getAdminToken(), 'keHoachSave', {
      sc_id: 'SC-999999',
      mo_ta: 'Test not found',
    });
    expect(res.body.ok).toBe(false);
    expect([400, 404]).toContain(res.status);
    expect(res.body.error).toContain('Không tìm thấy');
  });

  // ── Case 9: nextId prefix dung format ─────────────────
  test('12. nextId tao ID voi prefix KH-/KT-/NN- dung format (PREFIX-NNNNNN)', async () => {
    const scId = await createSc();

    // keHoachSave → KH-NNNNNN
    const khRes = await rpc(getAdminToken(), 'keHoachSave', {
      sc_id: scId,
      mo_ta: 'KH test format',
    });
    expect(khRes.body.ok).toBe(true);
    expect(khRes.body.result.id).toMatch(/^KH-\d{6}$/);

    // kiemTuSave → KT-NNNNNN
    const ktRes = await rpc(getAdminToken(), 'kiemTuSave', {
      sc_id: scId,
      mo_ta: 'KT test format',
    });
    expect(ktRes.body.ok).toBe(true);
    expect(ktRes.body.result.id).toMatch(/^KT-\d{6}$/);

    // nghiemThuSave → NN-NNNNNN
    const nnRes = await rpc(getAdminToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: '2026-08-29',
    });
    expect(nnRes.body.ok).toBe(true);
    expect(nnRes.body.result.id).toMatch(/^NN-\d{6}$/);
  });

  // ── Case 10: Moi save tra ve {id} va DB co 1 dong moi
  test('13. Moi save function tra ve {id} va DB co 1 dong moi tuong ung', async () => {
    const scId = await createSc();
    const today = new Date().toISOString().split('T')[0];

    // keHoachSave
    const khRes = await rpc(getAdminToken(), 'keHoachSave', {
      sc_id: scId,
      mo_ta: 'KH verify',
    });
    expect(khRes.body.ok).toBe(true);
    expect(khRes.body.result).toHaveProperty('id');
    const khDb = await db.query(
      'SELECT * FROM ke_hoach_sc WHERE id=$1 AND deleted_at=$2',
      [khRes.body.result.id, '']
    );
    expect(khDb.rows.length).toBe(1);
    expect(khDb.rows[0].sc_id).toBe(scId);
    expect(khDb.rows[0].is_test).toBe(1); // admin tao → is_test=1

    // kiemTuSave
    const ktRes = await rpc(getAdminToken(), 'kiemTuSave', {
      sc_id: scId,
      mo_ta: 'KT verify',
    });
    expect(ktRes.body.ok).toBe(true);
    expect(ktRes.body.result).toHaveProperty('id');
    const ktDb = await db.query(
      'SELECT * FROM phieu_kiem_tu WHERE id=$1 AND deleted_at=$2',
      [ktRes.body.result.id, '']
    );
    expect(ktDb.rows.length).toBe(1);
    expect(ktDb.rows[0].sc_id).toBe(scId);
    expect(ktDb.rows[0].is_test).toBe(1);

    // nghiemThuSave
    const nnRes = await rpc(getAdminToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: today,
      tong_vat_tu: 100000,
      tong_nhan_cong: 50000,
    });
    expect(nnRes.body.ok).toBe(true);
    expect(nnRes.body.result).toHaveProperty('id');
    const nnDb = await db.query(
      'SELECT * FROM bien_ban_nghiem WHERE id=$1 AND deleted_at=$2',
      [nnRes.body.result.id, '']
    );
    expect(nnDb.rows.length).toBe(1);
    expect(nnDb.rows[0].sc_id).toBe(scId);
    expect(nnDb.rows[0].is_test).toBe(1);

    // baogiaSave
    const bgRes = await rpc(getAdminToken(), 'baogiaSave', {
      sc_id: scId,
      ncc: 'NCC Verify',
      ngay: today,
      items: [{ ten: 'VT verify', so_luong: 1, don_gia: 50000 }],
    });
    expect(bgRes.body.ok).toBe(true);
    expect(bgRes.body.result).toHaveProperty('id');
    const bgDb = await db.query(
      'SELECT * FROM baogia WHERE id=$1 AND deleted_at=$2',
      [bgRes.body.result.id, '']
    );
    expect(bgDb.rows.length).toBe(1);
    expect(bgDb.rows[0].sc_id).toBe(scId);
    expect(bgDb.rows[0].is_test).toBe(1);
  });

  // ── Case bonus: Tong ket sau khi dien du 6/8 buoc ────
  test('14. Tong hop: sau khi dien 5 buoc (1,2,3,7 + step6 luon OK), chi con thieu buoc 4,5,8', async () => {
    const scId = await createSc();
    const today = new Date().toISOString().split('T')[0];

    // 1. Ke hoach
    await rpc(getAdminToken(), 'keHoachSave', { sc_id: scId, mo_ta: 'KH' });
    // 2. Kiem tu
    await rpc(getAdminToken(), 'kiemTuSave', { sc_id: scId, mo_ta: 'KT' });
    // 3. Bao gia (mirror bao_gia_ncc)
    await rpc(getAdminToken(), 'baogiaSave', {
      sc_id: scId,
      ncc: 'NCC',
      ngay: today,
      items: [{ ten: 'VT', so_luong: 1, don_gia: 100000 }],
    });
    // 7. Nghiem thu
    await rpc(getAdminToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: today,
    });

    const result = await check(scId);

    // Buoc 1,2,3,6,7 dat
    expect(findStep(result.steps, 1)!.ok).toBe(true);
    expect(findStep(result.steps, 2)!.ok).toBe(true);
    expect(findStep(result.steps, 3)!.ok).toBe(true);
    expect(findStep(result.steps, 6)!.ok).toBe(true); // luon OK
    expect(findStep(result.steps, 7)!.ok).toBe(true);

    // Buoc 4,5,8 chua dat (chua nhap kho, chua xuat kho, tong=0)
    expect(findStep(result.steps, 4)!.ok).toBe(false);
    expect(findStep(result.steps, 5)!.ok).toBe(false);
    expect(findStep(result.steps, 8)!.ok).toBe(false);

    // Tong cong 5/8 buoc → van ok=false
    expect(result.ok).toBe(false);
    expect(result.miss.length).toBe(3); // chi con 3 buoc thieu
  });
});
