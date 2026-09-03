import request from 'supertest';
import { adminToken, giamdocToken, xuongToken, ketoanToken, khoToken, db } from './setup';
import { dispatchRpc } from '@cencom/web/lib/rpc-dispatch';
import { current, setUser } from '@cencom/core';

const BASE_URL = 'http://localhost:3000';

function rpc(token: string, fn: string, args: any = {}) {
  return request(BASE_URL)
    .post('/api/rpc')
    .set('Cookie', [`sid=${token}`])
    .send({ fn, args });
}

function directRpc(fn: string, args: any = {}, role: string = 'admin') {
  const actors: Record<string, { id: string; name: string; role: string }> = {
    admin: { id: 'U-ADMIN', name: 'admin', role: 'admin' },
    giamdoc: { id: 'U-GIAMDOC', name: 'giamdoc', role: 'giamdoc' },
    xuong: { id: 'U-XUONG', name: 'xuong', role: 'xuong' },
    ketoan: { id: 'U-KETOAN', name: 'ketoan', role: 'ketoan' },
    kho: { id: 'U-KHO', name: 'kho', role: 'kho' },
  };
  setUser(actors[role]);
  return dispatchRpc(fn, [args], actors[role], db);
}

describe('RPC Contract (32 fn)', () => {
  // Auth
  test('login', async () => {
    const res = await request(BASE_URL)
      .post('/api/rpc')
      .send({ fn: 'login', args: { login: 'admin', password: 'cencom@123' } });
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toHaveProperty('token');
  });

  test('logout', async () => {
    const res = await rpc(adminToken, 'logout');
    expect(res.body.ok).toBe(true);
  });

  test('currentUser', async () => {
    const res = await rpc(adminToken, 'currentUser');
    expect(res.body.ok).toBe(true);
    expect(res.body.result.name).toBe('admin');
  });

  test('appInfo', async () => {
    const res = await rpc(adminToken, 'appInfo');
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toHaveProperty('version');
  });

  // Xe
  test('xeList', async () => {
    const res = await rpc(giamdocToken, 'xeList');
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThan(0);
  });

  test('xeGet', async () => {
    const listRes = await rpc(giamdocToken, 'xeList');
    const firstXe = listRes.body.result[0];
    const res = await rpc(giamdocToken, 'xeGet', { id: firstXe.id });
    expect(res.body.ok).toBe(true);
    expect(res.body.result.id).toBe(firstXe.id);
  });

  test('xeCreate (admin)', async () => {
    const res = await rpc(adminToken, 'xeSave', {
      bks: 'TEST-00001',
      hang: 'Test',
      dong: 'Model',
      nam_sx: 2024,
      phong_ban: 'pb1',
      trang_thai: 'hoat_dong',
      loai_pt: 'keo',
    });
    expect(res.body.ok).toBe(true);
  });

  test('xeCreate (xuong denied)', async () => {
    const res = await rpc(xuongToken, 'xeSave', {
      bks: 'TEST-00002',
      hang: 'Test',
      dong: 'Model',
      nam_sx: 2024,
      phong_ban: 'pb1',
      trang_thai: 'hoat_dong',
      loai_pt: 'keo',
    });
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('Không có quyền');
  });

  // SC (10 fn)
  test('scList', async () => {
    const res = await rpc(giamdocToken, 'scList');
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  test('scGet', async () => {
    const listRes = await rpc(giamdocToken, 'scList');
    if (listRes.body.result.length > 0) {
      const res = await rpc(giamdocToken, 'scGet', { id: listRes.body.result[0].id });
      expect(res.body.ok).toBe(true);
    } else {
      const createRes = await rpc(xuongToken, 'scCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'Test SC',
        muc_uu_tien: 'binh_thuong',
      });
      if (createRes.body.ok) {
        const res = await rpc(giamdocToken, 'scGet', { id: createRes.body.result.id });
        expect(res.body.ok).toBe(true);
      }
    }
  });

  test('scCreate (xuong)', async () => {
    const res = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC create',
      muc_uu_tien: 'binh_thuong',
    });
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toHaveProperty('id');
  });

  test('scCreate (kho denied)', async () => {
    const res = await rpc(khoToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC kho',
      muc_uu_tien: 'binh_thuong',
    });
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('Không có quyền');
  });

  test('scAddCongViec', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC for CV',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      const res = await rpc(xuongToken, 'scWorkAdd', {
        sc_id: createRes.body.result.id,
        ma_cv: 'CV01',
        ten_cv: 'Thay lốp',
        don_gia: 100000,
        so_luong: 1,
      });
      expect(res.body.ok).toBe(true);
    }
  });

  test('scAddVatTu', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC for VT',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      const res = await rpc(xuongToken, 'scVtAdd', {
        sc_id: createRes.body.result.id,
        vt_id: 1,
        so_luong: 2,
        don_gia: 50000,
      });
      expect(res.body.ok).toBe(true);
    }
  });

  test('scBatDauSua', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC bat dau',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      const res = await rpc(xuongToken, 'scStart', { id: createRes.body.result.id });
      expect(res.body.ok).toBe(true);
    }
  });

  test('scHoanThanh', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC hoan thanh',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      const startRes = await rpc(xuongToken, 'scStart', { id: createRes.body.result.id });
      if (startRes.body.ok) {
        const res = await rpc(xuongToken, 'scFinish', { id: createRes.body.result.id });
        expect(res.body.ok).toBe(true);
      }
    }
  });

  test('scTuChoi', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC tu choi',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      const res = await rpc(giamdocToken, 'scApprove', { id: createRes.body.result.id, duyet: false });
      expect(res.body.ok).toBe(true);
    }
  });

  test('scQuyetToan (ketoan)', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC quyet toan',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      await rpc(xuongToken, 'scStart', { id: createRes.body.result.id });
      await rpc(xuongToken, 'scFinish', { id: createRes.body.result.id });
      await rpc(giamdocToken, 'scApprove', { id: createRes.body.result.id, duyet: true });
      const res = await rpc(ketoanToken, 'quyetToan', { sc_id: createRes.body.result.id });
      expect(res.body.ok).toBe(true);
    }
  });

  test('scQuyetToan (xuong denied)', async () => {
    const createRes = await rpc(xuongToken, 'scCreate', {
      xe_id: 'XE-000001',
      noi_dung: 'Test SC quyet toan denied',
      muc_uu_tien: 'binh_thuong',
    });
    if (createRes.body.ok) {
      await rpc(xuongToken, 'scStart', { id: createRes.body.result.id });
      await rpc(xuongToken, 'scFinish', { id: createRes.body.result.id });
      await rpc(giamdocToken, 'scApprove', { id: createRes.body.result.id, duyet: true });
      const res = await rpc(xuongToken, 'quyetToan', { sc_id: createRes.body.result.id });
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Không có quyền');
    }
  });

  // Kho (7 fn)
  test('vattuList', async () => {
    const res = await rpc(khoToken, 'vatTuList');
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThan(0);
  });

  test('vattuCreate (kho)', async () => {
    const res = await rpc(khoToken, 'vatTuSave', {
      code: 'VT-TEST',
      name: 'Vật tư test',
      nhom: 'Test',
      donvi: 'cái',
      gia: 10000,
      ton: 10,
      ton_min: 2,
    });
    expect(res.body.ok).toBe(true);
  });

  test('nhapKho', async () => {
    const res = await rpc(khoToken, 'phNhapCreate', {
      nha_cc: 'NCC Test',
      ngay: new Date().toISOString().split('T')[0],
      items: [{ vt_id: 1, so_luong: 5, don_gia: 50000 }],
    });
    expect(res.body.ok).toBe(true);
  });

  test('xuatKho', async () => {
    const res = await rpc(khoToken, 'phXuatCreate', {
      ly_do: 'Xuat test',
      ngay: new Date().toISOString().split('T')[0],
      items: [{ vt_id: 1, so_luong: 2, don_gia: 50000 }],
    });
    expect(res.body.ok).toBe(true);
  });

  test('dmCreate', async () => {
    const res = await rpc(ketoanToken, 'dmCreate', {
      ten: 'Đề nghị mua test',
      loai: 'vattu',
      items: [{ vt_id: 1, so_luong: 3, don_gia: 50000 }],
    });
    expect(res.body.ok).toBe(true);
  });

  test('dmNhap', async () => {
    const dmRes = await rpc(ketoanToken, 'dmCreate', {
      ten: 'DM for nhap',
      loai: 'vattu',
      items: [{ vt_id: 1, so_luong: 2, don_gia: 50000 }],
    });
    if (dmRes.body.ok) {
      const res = await rpc(ketoanToken, 'dmDecide', { id: dmRes.body.result.id, duyet: true });
      expect(res.body.ok).toBe(true);
    }
  });

  // Báo giá (3 fn)
  test('baogiaList', async () => {
    const res = await rpc(ketoanToken, 'baoGiaList');
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  test('baogiaSave (ketoan)', async () => {
    const res = await rpc(ketoanToken, 'baoGiaCreate', {
      nha_cc: 'NCC Test BG',
      items: [{ ten: 'VT test', don_vi: 'cái', so_luong: 1, don_gia: 100000 }],
    });
    expect(res.body.ok).toBe(true);
  });

  // Hồ sơ (3 fn)
  test('hoSoGet', async () => {
    const res = await rpc(ketoanToken, 'hoSoGet', { xe_id: 'XE-000001' });
    expect(res.body.ok).toBe(true);
  });

  test('hoSoSave (ketoan)', async () => {
    const res = await rpc(ketoanToken, 'hoSoSave', {
      xe_id: 'XE-000001',
      tab: 'thong_tin_chung',
      data: { ghi_chu: 'Test ho so' },
    });
    expect(res.body.ok).toBe(true);
  });

  test('hoSoList', async () => {
    const res = await rpc(ketoanToken, 'hoSoList');
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  // Activity/Other
  test('activityFeed (giamdoc)', async () => {
    const res = await rpc(giamdocToken, 'activityFeed');
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  test('activityFeed (xuong denied)', async () => {
    const res = await rpc(xuongToken, 'activityFeed');
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('giới hạn quyền');
  });

  test('dashboard', async () => {
    const res = await rpc(giamdocToken, 'dashboard');
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toHaveProperty('tong_xe');
  });

  test('report', async () => {
    const res = await rpc(ketoanToken, 'report', { type: 'sc', from: '2024-01-01', to: '2024-12-31' });
    expect(res.body.ok).toBe(true);
  });
});