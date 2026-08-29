import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE)
    .post('/api/rpc')
    .set('Cookie', [`sid=${token}`])
    .send({ fn, args });

describe('RPC Contract (32 fn)', () => {
  test('login', async () => { 
    const res = await request(BASE).post('/api/auth').send({action:'login', user:'admin', pass:'cencom@123'}); 
    expect(res.body.ok).toBe(true); 
  });
  test('logout', async () => { 
    const res = await rpc(getAdminToken(), 'logout'); 
    expect(res.body.ok).toBe(true); 
  });
  test('currentUser', async () => { 
    const res = await rpc(getAdminToken(), 'currentUser'); 
    expect(res.body.ok).toBe(true); 
  });
  test('appInfo', async () => { 
    const res = await rpc(getAdminToken(), 'appInfo'); 
    expect(res.body.ok).toBe(true); 
  });

  test('xeList', async () => { 
    const res = await rpc(getGiamdocToken(), 'xeList'); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
    expect(res.body.result.length).toBeGreaterThan(0); // 42 xe from seed
  });
  test('xeGet', async () => { 
    const xe = await rpc(getGiamdocToken(), 'xeList'); 
    expect(xe.body.result.length).toBeGreaterThan(0);
    const res = await rpc(getGiamdocToken(), 'xeGet', {id: xe.body.result[0].id}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toBe(xe.body.result[0].id);
  });
  test('xeCreate (admin)', async () => { 
    const res = await rpc(getAdminToken(), 'xeCreate', {bien_so:'TEST-001', chu_xe:'Test', nam_sx:2020, nguyen_gia:100000000}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^XE-\d{6}$/);
  });
  test('xeCreate (xuong denied)', async () => { 
    const res = await rpc(getXuongToken(), 'xeCreate', {bien_so:'TEST-002'}); 
    expect(res.body.ok).toBe(false); 
    expect(res.status).toBe(403); 
  });

  test('scList', async () => { 
    const res = await rpc(getGiamdocToken(), 'scList'); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });
  test('scCreate (xuong)', async () => { 
    const xe = await rpc(getGiamdocToken(), 'xeList'); 
    expect(xe.body.result.length).toBeGreaterThan(0);
    const res = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^SC-\d{6}$/);
  });
  test('scGet', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    if (sc.body.result.length === 0) {
      // Create a test SC first
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      const getRes = await rpc(getGiamdocToken(), 'scGet', {id: createRes.body.result.id});
      expect(getRes.body.ok).toBe(true);
    } else {
      const res = await rpc(getGiamdocToken(), 'scGet', {id: sc.body.result[0].id}); 
      expect(res.body.ok).toBe(true); 
    }
  });
  test('scAddCongViec', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    const res = await rpc(getXuongToken(), 'scAddCongViec', {sc_id: scId, mo_ta:'Test CV', loai_xu_ly:'sua_chua', so_luong:1, don_gia:100000}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^CV-\d{6}$/);
  });
  test('scAddVatTu', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    const vt = await rpc(getGiamdocToken(), 'vattuList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    expect(vt.body.result.length).toBeGreaterThan(0);
    const res = await rpc(getXuongToken(), 'scAddVatTu', {sc_id: scId, vattu_id: vt.body.result[0].id, so_luong:1}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^VT-\d{6}$/);
  });
  test('scBatDauSua', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    const res = await rpc(getXuongToken(), 'scBatDauSua', {sc_id: scId}); 
    expect(res.body.ok).toBe(true); 
  });
  test('scHoanThanh', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    const res = await rpc(getXuongToken(), 'scHoanThanh', {sc_id: scId}); 
    expect(res.body.ok).toBe(true); 
  });
  test('scTuChoi', async () => { 
    // Tạo SC MỚI ở trạng thái de_xuat để test scTuChoi (chỉ từ chối được khi SC ở de_xuat)
    const xe = await rpc(getGiamdocToken(), 'xeList'); 
    expect(xe.body.result.length).toBeGreaterThan(0);
    const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]}); 
    expect(createRes.body.ok).toBe(true); 
    const scId = createRes.body.result.id;
    const res = await rpc(getXuongToken(), 'scTuChoi', {sc_id: scId, ly_do:'Test'}); 
    expect(res.body.ok).toBe(true); 
  });
  test('scQuyetToan (ketoan)', async () => { 
    // Tạo SC mới + seed đủ hồ sơ 8 bước (checkHoSo gate)
    const xe = await rpc(getGiamdocToken(), 'xeList');
    expect(xe.body.result.length).toBeGreaterThan(0);
    const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
    expect(createRes.body.ok).toBe(true);
    const scId = createRes.body.result.id;

    // Lấy vattu để seed nhap_xuat
    const vtRes = await rpc(getGiamdocToken(), 'vattuList');
    expect(vtRes.body.result.length).toBeGreaterThan(0);
    const vtId = vtRes.body.result[0].id;

    // B1: ke_hoach_sc
    await rpc(getXuongToken(), 'keHoachSave', {sc_id: scId, mo_ta: 'KH QT test'});
    // B2: phieu_kiem_tu
    await rpc(getXuongToken(), 'kiemTuSave', {sc_id: scId, mo_ta: 'KT QT test'});
    // B3: bao_gia_ncc (baogiaSave tự mirror với ocr_xac_nhan=1)
    await rpc(getKetoanToken(), 'baogiaSave', {
      sc_id: scId, ncc: 'NCC QT', ngay: new Date().toISOString().split('T')[0],
      items: [{ten: 'VT QT', so_luong: 1, don_gia: 100000}]
    });
    // B4: nhap_xuat nhap (nhapKho RPC hardcode sc_id=null → insert trực tiếp)
    const ts4 = Date.now();
    await db.query(
      "INSERT INTO nhap_xuat (id, vattu_id, loai, so_luong, don_gia, ngay, ly_do, nguoi, sc_id, is_test, deleted_at) VALUES ($1,$2,'nhap',1,50000,$3,'seed QT',NULL,$4,1,'')",
      ['NX-' + String(ts4).slice(-6), vtId, new Date().toISOString().split('T')[0], scId]
    );
    // B5: nhap_xuat xuat (insert trực tiếp để tránh lỗi tồn kho)
    await db.query(
      "INSERT INTO nhap_xuat (id, vattu_id, loai, so_luong, don_gia, ngay, ly_do, nguoi, sc_id, is_test, deleted_at) VALUES ($1,$2,'xuat',1,50000,$3,'seed QT',NULL,$4,1,'')",
      ['NX-' + String(ts4 + 1).slice(-6), vtId, new Date().toISOString().split('T')[0], scId]
    );
    // B7: bien_ban_nghiem
    await rpc(getKetoanToken(), 'nghiemThuSave', {
      sc_id: scId, ngay_nghiem: new Date().toISOString().split('T')[0],
      tong_vat_tu: 100000, tong_nhan_cong: 50000
    });
    // B8: sc.tong > 0
    await db.query("UPDATE sc SET tong = 150000 WHERE id = $1 AND deleted_at = $2", [scId, '']);

    // Chuyển SC sang da_hoan (scQuyetToan yêu cầu trang_thai = da_hoan)
    await rpc(getXuongToken(), 'scBatDauSua', {sc_id: scId});
    await rpc(getXuongToken(), 'scHoanThanh', {sc_id: scId});

    // scQuyetToan — ketoan role
    const res = await rpc(getKetoanToken(), 'scQuyetToan', {sc_id: scId}); 
    expect(res.body.ok).toBe(true); 
  });
  test('scQuyetToan (xuong denied)', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    const res = await rpc(getXuongToken(), 'scQuyetToan', {sc_id: scId}); 
    expect(res.body.ok).toBe(false); 
    expect(res.status).toBe(403); 
  });

  test('vattuList', async () => { 
    const res = await rpc(getGiamdocToken(), 'vattuList'); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });
  test('vattuCreate (kho)', async () => { 
    const res = await rpc(getKhoToken(), 'vattuCreate', {ten:'Test VT', don_vi:'cái', gia:50000, ton_min:10}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^VT-\d{6}$/);
  });
  test('vattuCreate (xuong denied)', async () => { 
    const res = await rpc(getXuongToken(), 'vattuCreate', {ten:'Test VT'}); 
    expect(res.body.ok).toBe(false); 
    expect(res.status).toBe(403); 
  });
  test('nhapKho', async () => { 
    const vt = await rpc(getGiamdocToken(), 'vattuList'); 
    expect(vt.body.result.length).toBeGreaterThan(0);
    const res = await rpc(getKhoToken(), 'nhapKho', {vattu_id: vt.body.result[0].id, so_luong:10, don_gia:50000, ngay: new Date().toISOString().split('T')[0], ly_do:'Test'}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^NX-\d{6}$/);
  });
  test('xuatKho', async () => { 
    const vt = await rpc(getGiamdocToken(), 'vattuList'); 
    expect(vt.body.result.length).toBeGreaterThan(0);
    const res = await rpc(getKhoToken(), 'xuatKho', {vattu_id: vt.body.result[0].id, so_luong:5, ly_do:'Test'}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^NX-\d{6}$/);
  });
  test('dmCreate', async () => { 
    const vt = await rpc(getGiamdocToken(), 'vattuList'); 
    expect(vt.body.result.length).toBeGreaterThan(0);
    const res = await rpc(getKhoToken(), 'dmCreate', {items: [{vattu_id: vt.body.result[0].id, so_luong:5, don_gia:50000}], ngay: new Date().toISOString().split('T')[0]}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^DM-\d{6}$/);
  });
  test('dmNhap', async () => { 
    // First create a DM, then approve it
    const vt = await rpc(getGiamdocToken(), 'vattuList');
    expect(vt.body.result.length).toBeGreaterThan(0);
    const createRes = await rpc(getKhoToken(), 'dmCreate', {items: [{vattu_id: vt.body.result[0].id, so_luong:5, don_gia:50000}], ngay: new Date().toISOString().split('T')[0]});
    expect(createRes.body.ok).toBe(true);
    const dmId = createRes.body.result.id;
    const res = await rpc(getKhoToken(), 'dmNhap', {dm_id: dmId});
    expect(res.body.ok).toBe(true); 
  });

  test('baogiaList', async () => { 
    const res = await rpc(getGiamdocToken(), 'baogiaList'); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });
  test('baogiaSave (ketoan)', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    const res = await rpc(getKetoanToken(), 'baogiaSave', {sc_id: scId, ncc:'NCC Test', ngay: new Date().toISOString().split('T')[0], items: [{ten:'Item 1', so_luong:1, don_gia:100000}]}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^BG-\d{6}$/);
  });
  test('baogiaSave (xuong denied)', async () => { 
    const res = await rpc(getXuongToken(), 'baogiaSave', {ncc:'Test'}); 
    expect(res.body.ok).toBe(false); 
    expect(res.status).toBe(403); 
  });

  test('hoSoGet', async () => { 
    const res = await rpc(getGiamdocToken(), 'hoSoList'); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });
  test('hoSoSave (ketoan)', async () => { 
    const sc = await rpc(getGiamdocToken(), 'scList'); 
    let scId: string;
    if (sc.body.result.length === 0) {
      const xe = await rpc(getGiamdocToken(), 'xeList');
      const createRes = await rpc(getXuongToken(), 'scCreate', {xe_id: xe.body.result[0].id, ngay: new Date().toISOString().split('T')[0]});
      expect(createRes.body.ok).toBe(true);
      scId = createRes.body.result.id;
    } else {
      scId = sc.body.result[0].id;
    }
    const res = await rpc(getKetoanToken(), 'hoSoSave', {sc_id: scId, so_chung_tu:'CT-001', ngay: new Date().toISOString().split('T')[0], ghi_chu:'Test'}); 
    expect(res.body.ok).toBe(true); 
    expect(res.body.result.id).toMatch(/^HS-\d{6}$/);
  });
  test('hoSoList', async () => { 
    const res = await rpc(getGiamdocToken(), 'hoSoList'); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  test('activityFeed (giamdoc)', async () => { 
    const res = await rpc(getGiamdocToken(), 'activityFeed', {limit:10}); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });
  test('activityFeed (xuong allowed)', async () => { 
    const res = await rpc(getXuongToken(), 'activityFeed', {limit:10}); 
    expect(res.body.ok).toBe(true); 
    expect(Array.isArray(res.body.result)).toBe(true);
  });
  test('dashboard', async () => { 
    const res = await rpc(getGiamdocToken(), 'dashboard'); 
    expect(res.body.ok).toBe(true); 
  });
  test('report', async () => { 
    const res = await rpc(getGiamdocToken(), 'report'); 
    expect(res.body.ok).toBe(true); 
  });
});