/**
 * QC206 Conformance Test — 8 bước sửa chữa ↔ checkHoSo()
 *
 * Mapping QC206 → checkHoSo().steps[]:
 *   B1 Kế hoạch (mẫu 01)     → step1 ke_hoach_sc     (blocking)
 *   B2 Kiểm tu                → step2 phieu_kiem_tu   (blocking)
 *   B3 Báo giá NCC           → step3 bao_gia_ncc      (blocking, ocr_xac_nhan=1)
 *   B4 Phiếu nhập vật tư     → step4 nhap_xuat (nhap) (blocking)
 *   B5 Phiếu xuất             → step5 nhap_xuat (xuat) (blocking)
 *   B6 VT cũ/hỏng + thanh lý → step6 (non-blocking, luôn ok)
 *   B7 Biên bản nghiệm thu   → step7 bien_ban_nghiem  (blocking)
 *   B8 Bảng kê chi tiết      → step8 sc.tong > 0      (blocking)
 *
 * scQuyetToan PHẢI bị chặn khi thiếu bất kỳ bước bắt buộc nào (1,2,3,4,5,7,8).
 */

import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Tạo SC mới cho test, trả về scId */
async function createTestSc(): Promise<string> {
  const xe = await rpc(getGiamdocToken(), 'xeList');
  expect(xe.body.ok).toBe(true);
  expect(xe.body.result.length).toBeGreaterThan(0);
  const res = await rpc(getXuongToken(), 'scCreate', {
    xe_id: xe.body.result[0].id,
    ngay: new Date().toISOString().split('T')[0],
  });
  expect(res.body.ok).toBe(true);
  return res.body.result.id;
}

/** Gọi hoSoCheck qua RPC, trả về body.result */
async function checkHoSo(scId: string): Promise<{
  ok: boolean;
  steps: { step: number; label: string; ok: boolean; note?: string; link?: string }[];
  miss: string[];
}> {
  const res = await rpc(getGiamdocToken(), 'hoSoCheck', { sc_id: scId });
  expect(res.body.ok).toBe(true);
  return res.body.result;
}

/** Tạo vattu test (idempotent — trả về vattuId dùng chung) */
let sharedVattuId: string;
async function ensureVattu(): Promise<string> {
  if (sharedVattuId) return sharedVattuId;
  const res = await rpc(getKhoToken(), 'vattuCreate', {
    ten: 'QC206 Test VT',
    don_vi: 'cái',
    gia: 50000,
    ton_min: 1,
  });
  expect(res.body.ok).toBe(true);
  sharedVattuId = res.body.result.id;
  // Nhập kho ban đầu (ton > 0)
  await rpc(getKhoToken(), 'nhapKho', {
    vattu_id: sharedVattuId,
    so_luong: 100,
    don_gia: 50000,
    ngay: new Date().toISOString().split('T')[0],
    ly_do: 'Seed QC206',
  });
  return sharedVattuId;
}

/**
 * Insert trực tiếp nhap_xuat với sc_id (vì nhapKho RPC hardcode sc_id=null).
 */
async function insertNhapXuat(scId: string, loai: 'nhap' | 'xuat'): Promise<void> {
  const vtId = await ensureVattu();
  const id = await db.query("SELECT nextval('config_value_seq') AS v").catch(() => null);
  // Dùng run trực tiếp
  const ts = Date.now();
  const nxId = `NX-${String(ts).slice(-6)}`;
  await db.query(
    `INSERT INTO nhap_xuat (id, vattu_id, loai, so_luong, don_gia, ngay, ly_do, nguoi, sc_id, is_test, deleted_at)
     VALUES ($1, $2, $3, 1, 50000, $4, 'QC206 test', NULL, $5, 1, '')`,
    [nxId, vtId, loai, new Date().toISOString().split('T')[0], scId]
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

describe('QC206 — Hồ sơ 8 bước sửa chữa ↔ checkHoSo conformance', () => {

  /* ── TC1: SC rỗng → tất cả bước bắt buộc fail, step6 ok ──────── */
  test('TC1 — SC mới (không data) → ok=false, miss chứa 7 label bắt buộc, step6 vẫn ok', async () => {
    const scId = await createTestSc();
    const r = await checkHoSo(scId);

    // Overall phải false
    expect(r.ok).toBe(false);

    // step6 PHẢI luôn ok (non-blocking)
    const step6 = r.steps.find(s => s.step === 6)!;
    expect(step6.ok).toBe(true);
    expect(step6.label).toContain('không bắt buộc');

    // Tất cả label bắt buộc phải có trong miss
    const requiredLabels = [
      'Kế hoạch sửa chữa (mẫu 01)',
      'Bản kiểm tu',
      'Báo giá NCC (đã xác nhận)',
      'Phiếu nhập kho vật tư mới',
      'Phiếu xuất kho cho SC',
      'Biên bản nghiệm thu',
      'Bảng kê chi tiết (tổng > 0)',
    ];
    for (const label of requiredLabels) {
      expect(r.miss).toContain(label);
    }
  });

  /* ── TC2: B1 — Kế hoạch SC (mẫu 01) ↔ step1 ─────────────────── */
  test('TC2 — B1 Kế hoạch SC: thiếu → step1.fail; có → step1.ok', async () => {
    const scId = await createTestSc();

    // Khi thiếu
    const before = await checkHoSo(scId);
    const step1Before = before.steps.find(s => s.step === 1)!;
    expect(step1Before.ok).toBe(false);
    expect(before.miss).toContain('Kế hoạch sửa chữa (mẫu 01)');

    // Thêm kế hoạch
    const saveRes = await rpc(getXuongToken(), 'keHoachSave', { sc_id: scId, mo_ta: 'Kế hoạch test QC206' });
    expect(saveRes.body.ok).toBe(true);

    // Khi có
    const after = await checkHoSo(scId);
    const step1After = after.steps.find(s => s.step === 1)!;
    expect(step1After.ok).toBe(true);
    expect(after.miss).not.toContain('Kế hoạch sửa chữa (mẫu 01)');
  });

  /* ── TC3: B2 — Bản kiểm tu ↔ step2 ───────────────────────────── */
  test('TC3 — B2 Kiểm tu: thiếu → step2.fail; có → step2.ok', async () => {
    const scId = await createTestSc();

    // Khi thiếu
    const before = await checkHoSo(scId);
    const step2Before = before.steps.find(s => s.step === 2)!;
    expect(step2Before.ok).toBe(false);
    expect(before.miss).toContain('Bản kiểm tu');

    // Thêm kiểm tu
    const saveRes = await rpc(getXuongToken(), 'kiemTuSave', { sc_id: scId, mo_ta: 'Kiểm tu test QC206' });
    expect(saveRes.body.ok).toBe(true);

    // Khi có
    const after = await checkHoSo(scId);
    const step2After = after.steps.find(s => s.step === 2)!;
    expect(step2After.ok).toBe(true);
    expect(after.miss).not.toContain('Bản kiểm tu');
  });

  /* ── TC4: B3 — Báo giá NCC (ocr_xac_nhan=1) ↔ step3 ─────────── */
  test('TC4 — B3 Báo giá NCC: thiếu → step3.fail; có (ocr_xac_nhan=1) → step3.ok', async () => {
    const scId = await createTestSc();

    // Khi thiếu
    const before = await checkHoSo(scId);
    const step3Before = before.steps.find(s => s.step === 3)!;
    expect(step3Before.ok).toBe(false);
    expect(before.miss).toContain('Báo giá NCC (đã xác nhận)');

    // Thêm báo giá NCC (baogiaSave tự mirror sang bao_gia_ncc với ocr_xac_nhan=1)
    const saveRes = await rpc(getKetoanToken(), 'baogiaSave', {
      sc_id: scId,
      ncc: 'NCC QC206',
      ngay: new Date().toISOString().split('T')[0],
      items: [{ ten: 'Vật tư test', so_luong: 1, don_gia: 100000 }],
    });
    expect(saveRes.body.ok).toBe(true);

    // Khi có
    const after = await checkHoSo(scId);
    const step3After = after.steps.find(s => s.step === 3)!;
    expect(step3After.ok).toBe(true);
    expect(after.miss).not.toContain('Báo giá NCC (đã xác nhận)');
  });

  /* ── TC5: B4 — Phiếu nhập kho vật tư mới ↔ step4 ─────────────── */
  test('TC5 — B4 Phiếu nhập kho: thiếu → step4.fail; có (loai=nhap+sc_id) → step4.ok', async () => {
    const scId = await createTestSc();
    await ensureVattu();

    // Khi thiếu
    const before = await checkHoSo(scId);
    const step4Before = before.steps.find(s => s.step === 4)!;
    expect(step4Before.ok).toBe(false);
    expect(before.miss).toContain('Phiếu nhập kho vật tư mới');

    // Insert trực tiếp nhap_xuat loai='nhap' + sc_id
    await insertNhapXuat(scId, 'nhap');

    // Khi có
    const after = await checkHoSo(scId);
    const step4After = after.steps.find(s => s.step === 4)!;
    expect(step4After.ok).toBe(true);
    expect(after.miss).not.toContain('Phiếu nhập kho vật tư mới');
  });

  /* ── TC6: B5 — Phiếu xuất kho ↔ step5 ────────────────────────── */
  test('TC6 — B5 Phiếu xuất kho: thiếu → step5.fail; có (loai=xuat+sc_id) → step5.ok', async () => {
    const scId = await createTestSc();
    const vtId = await ensureVattu();

    // Khi thiếu
    const before = await checkHoSo(scId);
    const step5Before = before.steps.find(s => s.step === 5)!;
    expect(step5Before.ok).toBe(false);
    expect(before.miss).toContain('Phiếu xuất kho cho SC');

    // Xuất kho qua RPC (xuatKho hỗ trợ sc_id)
    const xuatRes = await rpc(getKhoToken(), 'xuatKho', {
      vattu_id: vtId,
      so_luong: 1,
      sc_id: scId,
      ly_do: 'Xuất cho QC206',
    });
    expect(xuatRes.body.ok).toBe(true);

    // Khi có
    const after = await checkHoSo(scId);
    const step5After = after.steps.find(s => s.step === 5)!;
    expect(step5After.ok).toBe(true);
    expect(after.miss).not.toContain('Phiếu xuất kho cho SC');
  });

  /* ── TC7: B6 — VT cũ/hỏng + thanh lý → LUÔN OK (non-blocking) ── */
  test('TC7 — B6 VT cũ/hỏng: KHÔNG có data → step6 VẪN ok=true', async () => {
    const scId = await createTestSc();

    // Không thêm gì cả
    const r = await checkHoSo(scId);
    const step6 = r.steps.find(s => s.step === 6)!;
    expect(step6.ok).toBe(true);
    expect(step6.note).toContain('không bắt buộc');
  });

  /* ── TC8: B7 — Biên bản nghiệm thu ↔ step7 ───────────────────── */
  test('TC8 — B7 Biên bản nghiệm thu: thiếu → step7.fail; có → step7.ok', async () => {
    const scId = await createTestSc();

    // Khi thiếu
    const before = await checkHoSo(scId);
    const step7Before = before.steps.find(s => s.step === 7)!;
    expect(step7Before.ok).toBe(false);
    expect(before.miss).toContain('Biên bản nghiệm thu');

    // Thêm biên bản nghiệm thu
    const saveRes = await rpc(getKetoanToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: new Date().toISOString().split('T')[0],
      tong_vat_tu: 100000,
      tong_nhan_cong: 50000,
    });
    expect(saveRes.body.ok).toBe(true);

    // Khi có
    const after = await checkHoSo(scId);
    const step7After = after.steps.find(s => s.step === 7)!;
    expect(step7After.ok).toBe(true);
    expect(after.miss).not.toContain('Biên bản nghiệm thu');
  });

  /* ── TC9: B8 — Bảng kê chi tiết (tong > 0) ↔ step8 ──────────── */
  test('TC9 — B8 Bảng kê chi tiết: tong=0 → step8.fail; tong>0 → step8.ok', async () => {
    const scId = await createTestSc();

    // Khi tong=0 (mặc định)
    const before = await checkHoSo(scId);
    const step8Before = before.steps.find(s => s.step === 8)!;
    expect(step8Before.ok).toBe(false);
    expect(before.miss).toContain('Bảng kê chi tiết (tổng > 0)');

    // Cập nhật tong > 0
    await db.query('UPDATE sc SET tong = 150000 WHERE id = $1 AND deleted_at = $2', [scId, '']);

    // Khi tong > 0
    const after = await checkHoSo(scId);
    const step8After = after.steps.find(s => s.step === 8)!;
    expect(step8After.ok).toBe(true);
    expect(after.miss).not.toContain('Bảng kê chi tiết (tổng > 0)');
  });

  /* ── TC10: Tất cả bước đầy đủ → ok=true, miss=[] ────────────── */
  test('TC10 — Tất cả bước bắt buộc đầy đủ → ok=true, miss rỗng', async () => {
    const scId = await createTestSc();
    const vtId = await ensureVattu();

    // Thêm đầy đủ 7 bước bắt buộc (step6 tự ok)
    // B1: Kế hoạch
    const kh = await rpc(getXuongToken(), 'keHoachSave', { sc_id: scId, mo_ta: 'KH QC206' });
    expect(kh.body.ok).toBe(true);

    // B2: Kiểm tu
    const kt = await rpc(getXuongToken(), 'kiemTuSave', { sc_id: scId, mo_ta: 'KT QC206' });
    expect(kt.body.ok).toBe(true);

    // B3: Báo giá NCC
    const bg = await rpc(getKetoanToken(), 'baogiaSave', {
      sc_id: scId,
      ncc: 'NCC Full',
      ngay: new Date().toISOString().split('T')[0],
      items: [{ ten: 'Item 1', so_luong: 2, don_gia: 50000 }],
    });
    expect(bg.body.ok).toBe(true);

    // B4: Nhập kho (direct insert vì nhapKho hardcode sc_id=null)
    await insertNhapXuat(scId, 'nhap');

    // B5: Xuất kho
    const xuat = await rpc(getKhoToken(), 'xuatKho', {
      vattu_id: vtId,
      so_luong: 1,
      sc_id: scId,
      ly_do: 'Full QC206',
    });
    expect(xuat.body.ok).toBe(true);

    // B7: Biên bản nghiệm thu
    const nn = await rpc(getKetoanToken(), 'nghiemThuSave', {
      sc_id: scId,
      ngay_nghiem: new Date().toISOString().split('T')[0],
      tong_vat_tu: 200000,
      tong_nhan_cong: 100000,
    });
    expect(nn.body.ok).toBe(true);

    // B8: Tong > 0
    await db.query('UPDATE sc SET tong = 300000 WHERE id = $1 AND deleted_at = $2', [scId, '']);

    // Kiểm tra
    const r = await checkHoSo(scId);
    expect(r.ok).toBe(true);
    expect(r.miss).toEqual([]);
    expect(r.steps).toHaveLength(8);

    // Mỗi bước đều ok
    for (const s of r.steps) {
      expect(s.ok).toBe(true);
    }
  });

  /* ── TC11: scQuyetToan bị chặn khi thiếu hồ sơ ───────────────── */
  test('TC11 — scQuyetToan BỊ CHẶN khi checkHoSo.ok=false', async () => {
    const scId = await createTestSc();

    // Chuyển SC sang da_hoan (bắt buộc cho scQuyetToan)
    await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scId });
    await rpc(getXuongToken(), 'scHoanThanh', { sc_id: scId });

    // scQuyetToan PHẢI throw "thiếu hồ sơ" vì chưa đủ bước
    const res = await rpc(getKetoanToken(), 'scQuyetToan', { sc_id: scId });
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('thiếu hồ sơ');
  });

  /* ── TC12: scQuyetToan thành công khi đủ hồ sơ ───────────────── */
  test('TC12 — scQuyetToan THÀNH CÔNG khi tất cả bước bắt buộc đủ', async () => {
    const scId = await createTestSc();
    const vtId = await ensureVattu();

    // Thêm đầy đủ 7 bước bắt buộc
    await rpc(getXuongToken(), 'keHoachSave', { sc_id: scId, mo_ta: 'KH' });
    await rpc(getXuongToken(), 'kiemTuSave', { sc_id: scId, mo_ta: 'KT' });
    await rpc(getKetoanToken(), 'baogiaSave', {
      sc_id: scId, ncc: 'NCC', ngay: new Date().toISOString().split('T')[0],
      items: [{ ten: 'Item', so_luong: 1, don_gia: 100000 }],
    });
    await insertNhapXuat(scId, 'nhap');
    await rpc(getKhoToken(), 'xuatKho', { vattu_id: vtId, so_luong: 1, sc_id: scId, ly_do: 'test' });
    await rpc(getKetoanToken(), 'nghiemThuSave', {
      sc_id: scId, ngay_nghiem: new Date().toISOString().split('T')[0],
      tong_vat_tu: 100000, tong_nhan_cong: 50000,
    });
    await db.query('UPDATE sc SET tong = 150000 WHERE id = $1 AND deleted_at = $2', [scId, '']);

    // Verify hồ sơ ok
    const hs = await checkHoSo(scId);
    expect(hs.ok).toBe(true);

    // Chuyển trạng thái → da_hoan
    await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scId });
    await rpc(getXuongToken(), 'scHoanThanh', { sc_id: scId });

    // scQuyetToan phải thành công
    const res = await rpc(getKetoanToken(), 'scQuyetToan', { sc_id: scId });
    expect(res.body.ok).toBe(true);

    // Verify trạng thái
    const scRes = await rpc(getGiamdocToken(), 'scGet', { id: scId });
    expect(scRes.body.result.trang_thai).toBe('da_quyet');
  });

  /* ── TC13: scQuyetToan bị chặn — liệt kê đúng thiếu ──────────── */
  test('TC13 — scQuyetToan error message liệt kê đúng steps thiếu', async () => {
    const scId = await createTestSc();

    // Thêm CHỈ bước 1 + 2 (còn thiếu 3,4,5,7,8)
    await rpc(getXuongToken(), 'keHoachSave', { sc_id: scId, mo_ta: 'KH only' });
    await rpc(getXuongToken(), 'kiemTuSave', { sc_id: scId, mo_ta: 'KT only' });

    // Chuyển sang da_hoan
    await rpc(getXuongToken(), 'scBatDauSua', { sc_id: scId });
    await rpc(getXuongToken(), 'scHoanThanh', { sc_id: scId });

    // scQuyetToan PHẢI chặn
    const res = await rpc(getKetoanToken(), 'scQuyetToan', { sc_id: scId });
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('thiếu hồ sơ');

    // Kiểm tra message chứa các label thiếu
    expect(res.body.error).toContain('Báo giá NCC (đã xác nhận)');
    expect(res.body.error).toContain('Phiếu nhập kho vật tư mới');
    expect(res.body.error).toContain('Phiếu xuất kho cho SC');
    expect(res.body.error).toContain('Biên bản nghiệm thu');
    expect(res.body.error).toContain('Bảng kê chi tiết (tổng > 0)');
    // Không chứa bước đã có (1,2)
    expect(res.body.error).not.toContain('Kế hoạch sửa chữa (mẫu 01)');
    expect(res.body.error).not.toContain('Bản kiểm tu');
  });
});
