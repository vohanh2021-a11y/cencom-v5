import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

describe('Business Logic - State Machine SC', () => {
  let testScId: string;
  let testXeId: string;

  beforeAll(async () => {
    const xe = await rpc(getGiamdocToken(), 'xeList');
    expect(xe.body.result.length).toBeGreaterThan(0);
    testXeId = xe.body.result[0].id;
    const createRes = await rpc(getXuongToken(), 'scCreate', { xe_id: testXeId, ngay: new Date().toISOString().split('T')[0] });
    expect(createRes.body.ok).toBe(true);
    testScId = createRes.body.result.id;
  });

  test('scCreate → trang_thai = de_xuat', async () => {
    const res = await rpc(getGiamdocToken(), 'scGet', { id: testScId });
    expect(res.body.ok).toBe(true);
    expect(res.body.result.trang_thai).toBe('de_xuat');
  });

  test('scAddCongViec allowed on de_xuat', async () => {
    const res = await rpc(getXuongToken(), 'scAddCongViec', { 
      sc_id: testScId, mo_ta: 'Test CV', loai_xu_ly: 'sua_chua', so_luong: 1, don_gia: 100000 
    });
    expect(res.body.ok).toBe(true);
  });

  test('scBatDauSua: de_xuat → dang_sua', async () => {
    const res = await rpc(getXuongToken(), 'scBatDauSua', { sc_id: testScId });
    expect(res.body.ok).toBe(true);
    const getRes = await rpc(getGiamdocToken(), 'scGet', { id: testScId });
    expect(getRes.body.result.trang_thai).toBe('dang_sua');
  });

  test('scHoanThanh: dang_sua → da_hoan', async () => {
    const res = await rpc(getXuongToken(), 'scHoanThanh', { sc_id: testScId });
    expect(res.body.ok).toBe(true);
    const getRes = await rpc(getGiamdocToken(), 'scGet', { id: testScId });
    expect(getRes.body.result.trang_thai).toBe('da_hoan');
  });

  test('scQuyetToan: da_hoan → da_quyet (ketoan only)', async () => {
    // Seed8 bước hồ sơ (checkHoSo gate) trước khi quyết toán
    const vtRes = await rpc(getGiamdocToken(), 'vattuList');
    expect(vtRes.body.result.length).toBeGreaterThan(0);
    const vtId = vtRes.body.result[0].id;

    // B1: ke_hoach_sc
    await rpc(getXuongToken(), 'keHoachSave', {sc_id: testScId, mo_ta: 'KH QT'});
    // B2: phieu_kiem_tu
    await rpc(getXuongToken(), 'kiemTuSave', {sc_id: testScId, mo_ta: 'KT QT'});
    // B3: bao_gia_ncc (baogiaSave tự mirror với ocr_xac_nhan=1)
    await rpc(getKetoanToken(), 'baogiaSave', {
      sc_id: testScId, ncc: 'NCC QT', ngay: new Date().toISOString().split('T')[0],
      items: [{ten: 'VT QT', so_luong: 1, don_gia: 100000}]
    });
    // B4: nhap_xuat nhap (nhapKho RPC hardcode sc_id=null → insert trực tiếp)
    const ts4 = Date.now();
    await db.query(
      "INSERT INTO nhap_xuat (id, vattu_id, loai, so_luong, don_gia, ngay, ly_do, nguoi, sc_id, is_test, deleted_at) VALUES ($1,$2,'nhap',1,50000,$3,'seed QT',NULL,$4,1,'')",
      ['NX-' + String(ts4).slice(-6), vtId, new Date().toISOString().split('T')[0], testScId]
    );
    // B5: nhap_xuat xuat (insert trực tiếp để tránh lỗi tồn kho)
    await db.query(
      "INSERT INTO nhap_xuat (id, vattu_id, loai, so_luong, don_gia, ngay, ly_do, nguoi, sc_id, is_test, deleted_at) VALUES ($1,$2,'xuat',1,50000,$3,'seed QT',NULL,$4,1,'')",
      ['NX-' + String(ts4 + 1).slice(-6), vtId, new Date().toISOString().split('T')[0], testScId]
    );
    // B7: bien_ban_nghiem
    await rpc(getKetoanToken(), 'nghiemThuSave', {
      sc_id: testScId, ngay_nghiem: new Date().toISOString().split('T')[0],
      tong_vat_tu: 100000, tong_nhan_cong: 50000
    });
    // B8: sc.tong > 0
    await db.query("UPDATE sc SET tong = 150000 WHERE id = $1 AND deleted_at = $2", [testScId, '']);

    const res = await rpc(getKetoanToken(), 'scQuyetToan', { sc_id: testScId });
    expect(res.body.ok).toBe(true);
    const getRes = await rpc(getGiamdocToken(), 'scGet', { id: testScId });
    expect(getRes.body.result.trang_thai).toBe('da_quyet');
  });

  test('Block invalid transition: scBatDauSua on da_quyet → 403/400', async () => {
    const res = await rpc(getXuongToken(), 'scBatDauSua', { sc_id: testScId });
    expect([400, 403]).toContain(res.status);
  });

  test('Block invalid transition: scHoanThanh on de_xuat → 403/400', async () => {
    // Create new SC for this test
    const createRes = await rpc(getXuongToken(), 'scCreate', { xe_id: testXeId, ngay: new Date().toISOString().split('T')[0] });
    expect(createRes.body.ok).toBe(true);
    const newScId = createRes.body.result.id;
    const res = await rpc(getXuongToken(), 'scHoanThanh', { sc_id: newScId });
    expect([400, 403]).toContain(res.status);
  });

  test('scTuChoi: de_xuat → tu_choi', async () => {
    const createRes = await rpc(getXuongToken(), 'scCreate', { xe_id: testXeId, ngay: new Date().toISOString().split('T')[0] });
    expect(createRes.body.ok).toBe(true);
    const res = await rpc(getXuongToken(), 'scTuChoi', { sc_id: createRes.body.result.id, ly_do: 'Test reject' });
    expect(res.body.ok).toBe(true);
    const getRes = await rpc(getGiamdocToken(), 'scGet', { id: createRes.body.result.id });
    expect(getRes.body.result.trang_thai).toBe('tu_choi');
  });
});

describe('Business Logic - Inventory Non-Negative', () => {
  let testVattuId: string;

  beforeAll(async () => {
    // Create a test vattu with known stock
    const createRes = await rpc(getKhoToken(), 'vattuCreate', { ten: 'Test VT Stock', don_vi: 'cái', gia: 10000, ton_min: 5 });
    expect(createRes.body.ok).toBe(true);
    testVattuId = createRes.body.result.id;
    // Add initial stock via nhapKho
    const nhapRes = await rpc(getKhoToken(), 'nhapKho', { 
      vattu_id: testVattuId, so_luong: 10, don_gia: 10000, 
      ngay: new Date().toISOString().split('T')[0], ly_do: 'Initial stock' 
    });
    expect(nhapRes.body.ok).toBe(true);
  });

  test('xuatKho within stock → success', async () => {
    const res = await rpc(getKhoToken(), 'xuatKho', { 
      vattu_id: testVattuId, so_luong: 5, ly_do: 'Valid export' 
    });
    expect(res.body.ok).toBe(true);
  });

  test('xuatKho exceeding stock → fail (ton cannot go negative)', async () => {
    // Try to export more than available (10 - 5 = 5 remaining)
    const res = await rpc(getKhoToken(), 'xuatKho', { 
      vattu_id: testVattuId, so_luong: 10, ly_do: 'Exceed stock' 
    });
    expect(res.body.ok).toBe(false);
    expect([400, 403]).toContain(res.status);
  });

  test('ton_min warning respected (not enforced as hard error)', async () => {
    // This tests that ton_min is a warning threshold, not a hard block
    // Export down to near ton_min
    const res = await rpc(getKhoToken(), 'xuatKho', { 
      vattu_id: testVattuId, so_luong: 3, ly_do: 'Near min' 
    });
    // Should succeed but stock goes below ton_min
    expect(res.body.ok).toBe(true);
  });
});

describe('Business Logic - Soft Delete', () => {
  let testScId: string;
  let testXeId: string;

  beforeAll(async () => {
    const xe = await rpc(getGiamdocToken(), 'xeList');
    testXeId = xe.body.result[0].id;
    const createRes = await rpc(getXuongToken(), 'scCreate', { xe_id: testXeId, ngay: new Date().toISOString().split('T')[0] });
    testScId = createRes.body.result.id;
  });

  test('Soft deleted SC not returned by scList', async () => {
    // Manually soft-delete via DB (simulate admin action)
    await db.query('UPDATE sc SET deleted_at = $1 WHERE id = $2', [new Date().toISOString().split('T')[0], testScId]);
    
    const listRes = await rpc(getGiamdocToken(), 'scList');
    expect(listRes.body.ok).toBe(true);
    const found = listRes.body.result.find((s: any) => s.id === testScId);
    expect(found).toBeUndefined();
  });

  test('Soft deleted SC not returned by scGet', async () => {
    const getRes = await rpc(getGiamdocToken(), 'scGet', { id: testScId });
    // scGet filters by deleted_at='' in the query
    expect(getRes.body.ok).toBe(false);
    expect([400, 404]).toContain(getRes.status);
  });

  test('Soft deleted xe not returned by xeList', async () => {
    const xeId = 'XE-000001'; // from seed
    await db.query('UPDATE xe SET deleted_at = $1 WHERE id = $2', [new Date().toISOString().split('T')[0], xeId]);
    
    const listRes = await rpc(getGiamdocToken(), 'xeList');
    expect(listRes.body.ok).toBe(true);
    const found = listRes.body.result.find((x: any) => x.id === xeId);
    expect(found).toBeUndefined();
  });

  test('Soft deleted vattu not returned by vattuList', async () => {
    // Tạo vattu RIÊNG để soft-delete — không xóa vattu dùng chung
    // (tránh làm vattuList rỗng khiến các test khác trong suite thiếu dữ liệu).
    const createRes = await rpc(getKhoToken(), 'vattuCreate', { ten: 'Soft Delete VT', don_vi: 'cái', gia: 10000, ton_min: 1 });
    expect(createRes.body.ok).toBe(true);
    const vtId = createRes.body.result.id;
    await db.query('UPDATE vattu SET deleted_at = $1 WHERE id = $2', [new Date().toISOString().split('T')[0], vtId]);
    
    const listRes = await rpc(getGiamdocToken(), 'vattuList');
    expect(listRes.body.ok).toBe(true);
    const found = listRes.body.result.find((v: any) => v.id === vtId);
    expect(found).toBeUndefined();
  });
});

describe('Business Logic - Validation Args', () => {
  test('xeCreate missing bien_so → 422/400', async () => {
    const res = await rpc(getAdminToken(), 'xeCreate', { chu_xe: 'Test', nam_sx: 2020 });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('scCreate missing xe_id → 422/400', async () => {
    const res = await rpc(getXuongToken(), 'scCreate', { ngay: new Date().toISOString().split('T')[0] });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('scCreate missing ngay → 422/400', async () => {
    const xe = await rpc(getGiamdocToken(), 'xeList');
    const res = await rpc(getXuongToken(), 'scCreate', { xe_id: xe.body.result[0].id });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('scAddCongViec missing sc_id → 422/400', async () => {
    const res = await rpc(getXuongToken(), 'scAddCongViec', { mo_ta: 'Test', loai_xu_ly: 'sua_chua' });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('scAddVatTu missing vattu_id → 422/400', async () => {
    const sc = await rpc(getGiamdocToken(), 'scList');
    const res = await rpc(getXuongToken(), 'scAddVatTu', { sc_id: sc.body.result[0].id, so_luong: 1 });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('nhapKho missing vattu_id → 422/400', async () => {
    const res = await rpc(getKhoToken(), 'nhapKho', { so_luong: 10, don_gia: 50000, ngay: new Date().toISOString().split('T')[0] });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('xuatKho missing vattu_id → 422/400', async () => {
    const res = await rpc(getKhoToken(), 'xuatKho', { so_luong: 5, ly_do: 'Test' });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('vattuCreate missing ten → 422/400', async () => {
    const res = await rpc(getKhoToken(), 'vattuCreate', { don_vi: 'cái', gia: 50000 });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('baogiaSave missing sc_id → 422/400', async () => {
    const res = await rpc(getKetoanToken(), 'baogiaSave', { ncc: 'Test', ngay: new Date().toISOString().split('T')[0], items: [] });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('hoSoSave missing sc_id → 422/400', async () => {
    const res = await rpc(getKetoanToken(), 'hoSoSave', { so_chung_tu: 'CT-001', ngay: new Date().toISOString().split('T')[0] });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('dmCreate missing items → 422/400', async () => {
    const res = await rpc(getKhoToken(), 'dmCreate', { ngay: new Date().toISOString().split('T')[0] });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('Invalid loai_xu_ly in scAddCongViec → 422/400', async () => {
    const sc = await rpc(getGiamdocToken(), 'scList');
    const res = await rpc(getXuongToken(), 'scAddCongViec', { 
      sc_id: sc.body.result[0].id, mo_ta: 'Test', loai_xu_ly: 'invalid_type', so_luong: 1, don_gia: 100000 
    });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });

  test('Invalid trang_thai filter in scList → 422/400', async () => {
    const res = await rpc(getGiamdocToken(), 'scList', { trang_thai: 'invalid_state' });
    expect(res.body.ok).toBe(false);
    expect([400, 422]).toContain(res.status);
  });
});