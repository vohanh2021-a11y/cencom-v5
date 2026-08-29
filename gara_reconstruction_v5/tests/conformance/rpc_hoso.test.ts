import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

describe('RPC Hồ Sơ 8 Bước - Integration Tests', () => {
  let testXeId: string;
  let testScIdForXuong: string; // SC created by xuong for keHoach/kiemTu
  let testScIdForKetoan: string; // SC advanced to da_hoan for nghiemThu/scQuyetToan
  let testScIdForCheck: string; // SC with various steps for hoSoCheck

  beforeAll(async () => {
    // Get a vehicle from seed
    const xe = await rpc(getGiamdocToken(), 'xeList');
    expect(xe.body.result.length).toBeGreaterThan(0);
    testXeId = xe.body.result[0].id;

    // Create SC for xuong tests (keHoachSave, kiemTuSave)
    const scXuongRes = await rpc(getXuongToken(), 'scCreate', { 
      xe_id: testXeId, 
      ngay: new Date().toISOString().split('T')[0] 
    });
    expect(scXuongRes.body.ok).toBe(true);
    testScIdForXuong = scXuongRes.body.result.id;

    // Create SC for ketoan tests - advance to da_hoan
    const scKetoanRes = await rpc(getXuongToken(), 'scCreate', { 
      xe_id: testXeId, 
      ngay: new Date().toISOString().split('T')[0] 
    });
    expect(scKetoanRes.body.ok).toBe(true);
    testScIdForKetoan = scKetoanRes.body.result.id;

    // Advance SC to da_hoan for ketoan tests
    await rpc(getXuongToken(), 'scAddCongViec', { 
      sc_id: testScIdForKetoan, 
      mo_ta: 'Test CV', 
      loai_xu_ly: 'sua_chua', 
      so_luong: 1, 
      don_gia: 100000 
    });
    await rpc(getXuongToken(), 'scBatDauSua', { sc_id: testScIdForKetoan });
    await rpc(getXuongToken(), 'scHoanThanh', { sc_id: testScIdForKetoan });
    const verify = await rpc(getGiamdocToken(), 'scGet', { id: testScIdForKetoan });
    expect(verify.body.result.trang_thai).toBe('da_hoan');

    // Create SC for hoSoCheck with various steps completed
    const scCheckRes = await rpc(getXuongToken(), 'scCreate', { 
      xe_id: testXeId, 
      ngay: new Date().toISOString().split('T')[0] 
    });
    expect(scCheckRes.body.ok).toBe(true);
    testScIdForCheck = scCheckRes.body.result.id;

    // Add some steps for hoSoCheck test
    await rpc(getXuongToken(), 'scAddCongViec', { 
      sc_id: testScIdForCheck, 
      mo_ta: 'Kế hoạch test', 
      loai_xu_ly: 'sua_chua', 
      so_luong: 1, 
      don_gia: 100000 
    });
    // Note: Other steps (kiem tu, bao gia, nhap/xuat kho, nghiem thu) would need more setup
    // but we test the structure returns 8 steps regardless
  });

  describe('1. keHoachSave - xuong role (has sc.sua)', () => {
    test('xuong creates keHoachSave with valid sc_id → 200/ok', async () => {
      const res = await rpc(getXuongToken(), 'keHoachSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Kế hoạch sửa chữa mẫu 01' 
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.id).toMatch(/^KH-\d{6}$/);
    });

    test('admin creates keHoachSave → 200/ok', async () => {
      const res = await rpc(getAdminToken(), 'keHoachSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Admin kế hoạch' 
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('2. kiemTuSave - xuong role (has sc.sua)', () => {
    test('xuong creates kiemTuSave with valid sc_id → 200/ok', async () => {
      const res = await rpc(getXuongToken(), 'kiemTuSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Bản kiểm tu vật tư' 
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.id).toMatch(/^KT-\d{6}$/);
    });

    test('admin creates kiemTuSave → 200/ok', async () => {
      const res = await rpc(getAdminToken(), 'kiemTuSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Admin kiểm tu' 
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('3. nghiemThuSave - ketoan role (has sc.kehoach)', () => {
    test('ketoan creates nghiemThuSave with valid sc_id → 200/ok', async () => {
      const res = await rpc(getKetoanToken(), 'nghiemThuSave', { 
        sc_id: testScIdForKetoan,
        ngay_nghiem: new Date().toISOString().split('T')[0],
        tong_vat_tu: 500000,
        tong_nhan_cong: 300000
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.id).toMatch(/^NN-\d{6}$/);
    });

    test('admin creates nghiemThuSave → 200/ok', async () => {
      const res = await rpc(getAdminToken(), 'nghiemThuSave', { 
        sc_id: testScIdForKetoan,
        ngay_nghiem: new Date().toISOString().split('T')[0],
        tong_vat_tu: 100000,
        tong_nhan_cong: 50000
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('4. RBAC - Invalid/Unauthorized roles for keHoachSave', () => {
    test('laixe (no valid token) calling keHoachSave → 401', async () => {
      // Use invalid token to simulate laixe (no account)
      const res = await request(BASE)
        .post('/api/rpc')
        .set('Cookie', ['sid=invalid.laixe.token'])
        .send({ fn: 'keHoachSave', args: { sc_id: testScIdForXuong, mo_ta: 'Test' } });
      expect(res.status).toBe(401);
    });

    test('kho role calling keHoachSave (no sc.sua) → 403', async () => {
      const res = await rpc(getKhoToken(), 'keHoachSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Kho thử tạo' 
      });
      expect([401, 403]).toContain(res.status);
    });

    test('giamdoc role calling keHoachSave (no sc.sua) → 403', async () => {
      const res = await rpc(getGiamdocToken(), 'keHoachSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Giamdoc thử tạo' 
      });
      expect([401, 403]).toContain(res.status);
    });

    test('xuong role calling keHoachSave (has sc.sua) → 200/ok', async () => {
      const res = await rpc(getXuongToken(), 'keHoachSave', { 
        sc_id: testScIdForXuong, 
        mo_ta: 'Xuong tạo kế hoạch' 
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('5. Input Validation - Edge Cases for sc_id', () => {
     test('sc_id empty string → 400/422 (not crash)', async () => {
       const res = await rpc(getXuongToken(), 'keHoachSave', { sc_id: '', mo_ta: 'Test' });
       expect(res.body.ok).toBe(false);
       expect([400, 422]).toContain(res.status);
     });

     test('sc_id very long string (200 chars) → 400/422 (not crash)', async () => {
       const longId = 'X'.repeat(200);
       const res = await rpc(getXuongToken(), 'keHoachSave', { sc_id: longId, mo_ta: 'Test' });
       expect(res.body.ok).toBe(false);
       expect([400, 422]).toContain(res.status);
     });

     test('sc_id SQL injection payload → 400/422/404 (safe, no SQLi)', async () => {
       const sqlPayload = "' OR 1=1--";
       const res = await rpc(getXuongToken(), 'keHoachSave', { sc_id: sqlPayload, mo_ta: 'Test' });
       expect(res.body.ok).toBe(false);
       expect([400, 404, 422]).toContain(res.status);
     });

     test('sc_id non-existent (valid format but not in DB) → 404', async () => {
       const res = await rpc(getXuongToken(), 'keHoachSave', { sc_id: 'SC-999999', mo_ta: 'Test' });
       expect(res.body.ok).toBe(false);
       expect([400, 404]).toContain(res.status);
     });

     test('sc_id empty string for kiemTuSave → 400/422', async () => {
       const res = await rpc(getXuongToken(), 'kiemTuSave', { sc_id: '', mo_ta: 'Test' });
       expect(res.body.ok).toBe(false);
       expect([400, 422]).toContain(res.status);
     });

     test('sc_id SQL injection for nghiemThuSave (ketoan) → handled safely', async () => {
       const res = await rpc(getKetoanToken(), 'nghiemThuSave', { 
         sc_id: "' OR 1=1--", 
         ngay_nghiem: new Date().toISOString().split('T')[0],
         tong_vat_tu: 1000,
         tong_nhan_cong: 500
       });
       expect(res.body.ok).toBe(false);
       expect([400, 404, 422]).toContain(res.status);
     });
   });

  describe('6. hoSoCheck - returns correct 8-step structure', () => {
    test('hoSoCheck returns steps.length === 8 with correct labels', async () => {
      const res = await rpc(getGiamdocToken(), 'hoSoCheck', { sc_id: testScIdForCheck });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.result.steps)).toBe(true);
      expect(res.body.result.steps.length).toBe(8);

      const steps = res.body.result.steps;
      const expectedLabels = [
        'Kế hoạch sửa chữa (mẫu 01)',
        'Bản kiểm tu',
        'Báo giá NCC (đã xác nhận)',
        'Phiếu nhập kho vật tư mới',
        'Phiếu xuất kho cho SC',
        'Nhập VT cũ/hỏng + thanh lý (không bắt buộc)',
        'Biên bản nghiệm thu',
        'Bảng kê chi tiết (tổng > 0)'
      ];

      steps.forEach((step: any, idx: number) => {
        expect(step.step).toBe(idx + 1);
        expect(step.label).toBe(expectedLabels[idx]);
        expect(typeof step.ok).toBe('boolean');
        expect(typeof step.note).toBe('string');
      });

      // Step 6 should always be ok=true (not required)
      expect(steps[5].ok).toBe(true);
      expect(steps[5].step).toBe(6);

      // miss array should contain labels of blocking steps that are not ok
      expect(Array.isArray(res.body.result.miss)).toBe(true);
    });

    test('hoSoCheck with non-existent sc_id → returns ok=false with miss', async () => {
      const res = await rpc(getGiamdocToken(), 'hoSoCheck', { sc_id: 'SC-999999' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true); // RPC ok, but check result ok=false
      expect(res.body.result.ok).toBe(false);
      expect(res.body.result.miss).toContain('Phiếu sửa chữa không tồn tại');
    });

    test('hoSoCheck with empty sc_id → 400/422', async () => {
      const res = await rpc(getGiamdocToken(), 'hoSoCheck', { sc_id: '' });
      expect(res.body.ok).toBe(false);
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('7. scQuyetToan gate - missing hồ sơ blocks', () => {
    // Create a fresh SC at da_hoan but WITHOUT hồ sơ (keHoach, kiemTu, nghiemThu)
    let freshScId: string;

    beforeAll(async () => {
      const scRes = await rpc(getXuongToken(), 'scCreate', { 
        xe_id: testXeId, 
        ngay: new Date().toISOString().split('T')[0] 
      });
      expect(scRes.body.ok).toBe(true);
      freshScId = scRes.body.result.id;

      // Advance to da_hoan without creating hồ sơ records
      await rpc(getXuongToken(), 'scAddCongViec', { 
        sc_id: freshScId, 
        mo_ta: 'CV', 
        loai_xu_ly: 'sua_chua', 
        so_luong: 1, 
        don_gia: 100000 
      });
      await rpc(getXuongToken(), 'scBatDauSua', { sc_id: freshScId });
      await rpc(getXuongToken(), 'scHoanThanh', { sc_id: freshScId });
    });

    test('scQuyetToan on SC missing hồ sơ (keHoach, kiemTu, nghiemThu) → error contains "thiếu hồ sơ"', async () => {
      const res = await rpc(getKetoanToken(), 'scQuyetToan', { sc_id: freshScId });
      expect(res.body.ok).toBe(false);
      expect([400, 403]).toContain(res.status);
      // The error message should indicate missing hồ sơ
      const errorMsg = (res.body.error || res.body.message || '').toLowerCase();
      expect(errorMsg).toMatch(/thiếu|hồ sơ|missing|hồ sơ/i);
    });
  });

  describe('8. Cross-role permission checks for hồ sơ functions', () => {
    test('kho cannot keHoachSave (no sc.sua) → 403', async () => {
      const res = await rpc(getKhoToken(), 'keHoachSave', { sc_id: testScIdForXuong, mo_ta: 'Test' });
      expect([401, 403]).toContain(res.status);
    });

    test('kho cannot kiemTuSave (no sc.sua) → 403', async () => {
      const res = await rpc(getKhoToken(), 'kiemTuSave', { sc_id: testScIdForXuong, mo_ta: 'Test' });
      expect([401, 403]).toContain(res.status);
    });

    test('giamdoc cannot nghiemThuSave (no sc.kehoach) → 403', async () => {
      const res = await rpc(getGiamdocToken(), 'nghiemThuSave', { 
        sc_id: testScIdForKetoan,
        ngay_nghiem: new Date().toISOString().split('T')[0],
        tong_vat_tu: 1000,
        tong_nhan_cong: 500
      });
      expect([401, 403]).toContain(res.status);
    });

    test('kho cannot nghiemThuSave (no sc.kehoach) → 403', async () => {
      const res = await rpc(getKhoToken(), 'nghiemThuSave', { 
        sc_id: testScIdForKetoan,
        ngay_nghiem: new Date().toISOString().split('T')[0],
        tong_vat_tu: 1000,
        tong_nhan_cong: 500
      });
      expect([401, 403]).toContain(res.status);
    });

    test('xuong CAN nghiemThuSave (has sc.kehoach) → 200/ok', async () => {
      const res = await rpc(getXuongToken(), 'nghiemThuSave', { 
        sc_id: testScIdForKetoan,
        ngay_nghiem: new Date().toISOString().split('T')[0],
        tong_vat_tu: 1000,
        tong_nhan_cong: 500
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result.id).toMatch(/^NN-\d{6}$/);
    });

    test('hoSoCheck allowed for all roles with hoso.xem (giamdoc, xuong, ketoan, kho)', async () => {
      for (const token of [getGiamdocToken(), getXuongToken(), getKetoanToken(), getKhoToken()]) {
        const res = await rpc(token, 'hoSoCheck', { sc_id: testScIdForCheck });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.result.steps.length).toBe(8);
      }
    });
  });
});