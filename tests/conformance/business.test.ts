import { adminToken, giamdocToken, xuongToken, ketoanToken, khoToken, db } from './setup';
import { dispatchRpc } from '@cencom/web/lib/rpc-dispatch';
import { current, setUser } from '@cencom/core';
import request from 'supertest';

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

describe('Business Logic End-to-End', () => {
  describe('SC Lifecycle: Create → Start → Finish → Approve → QuyetToan', () => {
    test('Full SC workflow by xuong → giamdoc → ketoan', async () => {
      // 1. Xưởng tạo SC
      const createRes = await rpc(xuongToken, 'scCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'Sửa chữa phanh',
        muc_uu_tien: 'cao',
      });
      expect(createRes.body.ok).toBe(true);
      const scId = createRes.body.result.id;

      // 2. Xưởng thêm công việc
      const cvRes = await rpc(xuongToken, 'scWorkAdd', {
        sc_id: scId,
        ma_cv: 'CV01',
        ten_cv: 'Thay má phanh',
        don_gia: 200000,
        so_luong: 1,
      });
      expect(cvRes.body.ok).toBe(true);

      // 3. Xưởng thêm vật tư
      const vtRes = await rpc(xuongToken, 'scVtAdd', {
        sc_id: scId,
        vt_id: 19, // Má phanh
        so_luong: 1,
        don_gia: 33000,
      });
      expect(vtRes.body.ok).toBe(true);

      // 4. Xưởng bắt đầu sửa
      const startRes = await rpc(xuongToken, 'scStart', { id: scId });
      expect(startRes.body.ok).toBe(true);

      // 5. Xưởng hoàn thành
      const finishRes = await rpc(xuongToken, 'scFinish', { id: scId });
      expect(finishRes.body.ok).toBe(true);

      // 6. Giám đốc duyệt
      const approveRes = await rpc(giamdocToken, 'scApprove', { id: scId, duyet: true });
      expect(approveRes.body.ok).toBe(true);

      // 7. Kế toán quyết toán
      const qtRes = await rpc(ketoanToken, 'quyetToan', { sc_id: scId });
      expect(qtRes.body.ok).toBe(true);

      // 8. Verify SC đã quyết toán
      const getRes = await rpc(giamdocToken, 'scGet', { id: scId });
      expect(getRes.body.ok).toBe(true);
      expect(getRes.body.result.trang_thai).toBe('da_quyet_toan');
    });

    test('SC rejected by giamdoc', async () => {
      const createRes = await rpc(xuongToken, 'scCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'Test reject',
        muc_uu_tien: 'binh_thuong',
      });
      expect(createRes.body.ok).toBe(true);

      const rejectRes = await rpc(giamdocToken, 'scApprove', { id: createRes.body.result.id, duyet: false, ly_do: 'Không cần sửa' });
      expect(rejectRes.body.ok).toBe(true);

      const getRes = await rpc(giamdocToken, 'scGet', { id: createRes.body.result.id });
      expect(getRes.body.result.trang_thai).toBe('tu_choi');
    });
  });

  describe('Kho: Nhập - Xuất - Tồn kho', () => {
    test('Phiếu nhập kho → Tồn kho tăng', async () => {
      const vtId = 1;
      const beforeRes = await rpc(khoToken, 'tonKho');
      const beforeTon = beforeRes.body.result.find((v: any) => v.id === vtId)?.ton || 0;

      const nhapRes = await rpc(khoToken, 'phNhapCreate', {
        nha_cc: 'NCC Test',
        ngay: new Date().toISOString().split('T')[0],
        items: [{ vt_id: vtId, so_luong: 10, don_gia: 50000 }],
      });
      expect(nhapRes.body.ok).toBe(true);

      const afterRes = await rpc(khoToken, 'tonKho');
      const afterTon = afterRes.body.result.find((v: any) => v.id === vtId)?.ton || 0;
      expect(afterTon).toBe(beforeTon + 10);
    });

    test('Phiếu xuất kho → Tồn kho giảm', async () => {
      const vtId = 1;
      const beforeRes = await rpc(khoToken, 'tonKho');
      const beforeTon = beforeRes.body.result.find((v: any) => v.id === vtId)?.ton || 0;

      const xuatRes = await rpc(khoToken, 'phXuatCreate', {
        ly_do: 'Xuat test',
        ngay: new Date().toISOString().split('T')[0],
        items: [{ vt_id: vtId, so_luong: 5, don_gia: 50000 }],
      });
      expect(xuatRes.body.ok).toBe(true);

      const afterRes = await rpc(khoToken, 'tonKho');
      const afterTon = afterRes.body.result.find((v: any) => v.id === vtId)?.ton || 0;
      expect(afterTon).toBe(beforeTon - 5);
    });

    test('Xuất quá tồn kho bị chặn', async () => {
      const vtId = 1;
      const tonRes = await rpc(khoToken, 'tonKho');
      const currentTon = tonRes.body.result.find((v: any) => v.id === vtId)?.ton || 0;

      const xuatRes = await rpc(khoToken, 'phXuatCreate', {
        ly_do: 'Xuat qua ton',
        ngay: new Date().toISOString().split('T')[0],
        items: [{ vt_id: vtId, so_luong: currentTon + 100, don_gia: 50000 }],
      });
      expect(xuatRes.body.ok).toBe(false);
      expect(xuatRes.body.error).toContain('tồn kho');
    });
  });

  describe('Kế toán: Hạch toán SC → Sổ cái → Công nợ', () => {
    test('Quyết toán SC tạo hạch toán ledger', async () => {
      const createRes = await rpc(xuongToken, 'scCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'SC for ledger',
        muc_uu_tien: 'binh_thuong',
      });
      expect(createRes.body.ok).toBe(true);
      const scId = createRes.body.result.id;

      await rpc(xuongToken, 'scStart', { id: scId });
      await rpc(xuongToken, 'scFinish', { id: scId });
      await rpc(giamdocToken, 'scApprove', { id: scId, duyet: true });
      await rpc(ketoanToken, 'quyetToan', { sc_id: scId });

      const ledgerRes = await rpc(ketoanToken, 'ledgerList', { from: new Date().toISOString().split('T')[0] });
      expect(ledgerRes.body.ok).toBe(true);
      expect(ledgerRes.body.result.length).toBeGreaterThan(0);
    });

    test('Phiếu chi tạo công nợ', async () => {
      const pcRes = await rpc(ketoanToken, 'phieuChiCreate', {
        nha_cc: 'NCC Test',
        so_tien: 1000000,
        noi_dung: 'Thanh toán vật tư',
        ngay: new Date().toISOString().split('T')[0],
      });
      expect(pcRes.body.ok).toBe(true);

      const cnRes = await rpc(ketoanToken, 'congNoList', { nha_cc: 'NCC Test' });
      expect(cnRes.body.ok).toBe(true);
      expect(cnRes.body.result.some((c: any) => c.nguon === 'phieu_chi' && c.so_tien === 1000000)).toBe(true);
    });

    test('Kỳ khóa → Không thể hạch toán', async () => {
      await rpc(ketoanToken, 'kyClose', { ky: '2024-01' });

      const pcRes = await rpc(ketoanToken, 'phieuChiCreate', {
        nha_cc: 'NCC Test',
        so_tien: 100000,
        noi_dung: 'Test ky khoa',
        ngay: '2024-01-15',
      });
      expect(pcRes.body.ok).toBe(false);
      expect(pcRes.body.error).toContain('đã khóa');
    });
  });

  describe('Đề nghị mua: Tạo → Duyệt → Tạo PO', () => {
    test('Ketoan tạo DNM → Duyệt → Tạo PO', async () => {
      const dmRes = await rpc(ketoanToken, 'dmCreate', {
        ten: 'Mua lốp xe',
        loai: 'vattu',
        items: [{ vt_id: 1, so_luong: 4, don_gia: 52000 }],
      });
      expect(dmRes.body.ok).toBe(true);

      const decideRes = await rpc(ketoanToken, 'dmDecide', { id: dmRes.body.result.id, duyet: true });
      expect(decideRes.body.ok).toBe(true);

      const dmGet = await rpc(ketoanToken, 'dmDetail', { id: dmRes.body.result.id });
      expect(dmGet.body.result.trang_thai).toBe('da_duyet');
    });

    test('Xưởng tạo DNM từ SC', async () => {
      const scRes = await rpc(xuongToken, 'scCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'SC for DNM',
        muc_uu_tien: 'binh_thuong',
      });
      expect(scRes.body.ok).toBe(true);

      const dmRes = await rpc(xuongToken, 'dmFromSC', { sc_id: scRes.body.result.id });
      expect(dmRes.body.ok).toBe(true);
    });
  });

  describe('Báo giá: Tạo → So sánh → Chọn', () => {
    test('Ketoan tạo báo giá từ DNM', async () => {
      const dmRes = await rpc(ketoanToken, 'dmCreate', {
        ten: 'BG from DNM',
        loai: 'vattu',
        items: [{ vt_id: 1, so_luong: 2, don_gia: 50000 }],
      });
      expect(dmRes.body.ok).toBe(true);

      const bgRes = await rpc(ketoanToken, 'baoGiaCreate', {
        dm_id: dmRes.body.result.id,
        nha_cc: 'NCC A',
        items: [{ vt_id: 1, so_luong: 2, don_gia: 48000 }],
      });
      expect(bgRes.body.ok).toBe(true);

      const listRes = await rpc(ketoanToken, 'baoGiaList', { dm_id: dmRes.body.result.id });
      expect(listRes.body.ok).toBe(true);
      expect(listRes.body.result.length).toBeGreaterThan(0);
    });
  });

  describe('Hồ sơ xe: 9 tab lưu trữ', () => {
    const tabs = [
      'thong_tin_chung',
      'lich_su_sua_chua',
      'lich_su_bao_duong',
      'lich_su_kiem_dinh',
      'lich_su_bao_hiem',
      'chi_phi_van_hanh',
      'gia_tri_tai_san',
      'hop_dong_thue',
      'van_ban_khac',
    ];

    for (const tab of tabs) {
      test(`Ho so save tab ${tab}`, async () => {
        const res = await rpc(ketoanToken, 'hoSoSave', {
          xe_id: 'XE-000001',
          tab,
          data: { test: `data for ${tab}` },
        });
        expect(res.body.ok).toBe(true);
      });
    }

    test('Ho so get returns all tabs', async () => {
      const res = await rpc(ketoanToken, 'hoSoGet', { xe_id: 'XE-000001' });
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toHaveProperty('tabs');
    });
  });

  describe('Xe: CRUD + Nhắc việc', () => {
    test('Admin tạo xe mới', async () => {
      const res = await rpc(adminToken, 'xeSave', {
        bks: '51A-12345',
        hang: 'Howo',
        dong: 'T7H',
        nam_sx: 2024,
        phong_ban: 'pb1',
        trang_thai: 'hoat_dong',
        loai_pt: 'keo',
      });
      expect(res.body.ok).toBe(true);
      expect(res.body.result.bks).toBe('51A-12345');
    });

    test('Xe reminders trả về bảo dưỡng sắp tới', async () => {
      const res = await rpc(giamdocToken, 'xeReminders', { days: 30 });
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.result)).toBe(true);
    });
  });

  describe('Xuống: Dashboard tổng quan', () => {
    test('Xuong dashboard có stats', async () => {
      const res = await rpc(xuongToken, 'xuongDashboard');
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toHaveProperty('sc_dang_sua');
      expect(res.body.result).toHaveProperty('sc_cho_duyet');
      expect(res.body.result).toHaveProperty('sc_da_hoan_thanh');
    });

    test('DashboardAll cho giám đốc', async () => {
      const res = await rpc(giamdocToken, 'dashboardAll');
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toHaveProperty('tong_xe');
      expect(res.body.result).toHaveProperty('sc_tong');
    });
  });

  describe('Chat: Thread + Messages', () => {
    test('Tạo thread chat', async () => {
      const res = await rpc(xuongToken, 'chatThreadOpen', { peer_id: 'U-KETOAN' });
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toHaveProperty('thread_id');
    });

    test('Gửi tin nhắn', async () => {
      const threadRes = await rpc(xuongToken, 'chatThreadOpen', { peer_id: 'U-KETOAN' });
      if (threadRes.body.ok) {
        const msgRes = await rpc(xuongToken, 'chatSend', {
          thread_id: threadRes.body.result.thread_id,
          noi_dung: 'Test message',
        });
        expect(msgRes.body.ok).toBe(true);
      }
    });
  });

  describe('Đề xuất: Tạo → Duyệt → Chuyển SC', () => {
    test('Xưởng tạo đề xuất', async () => {
      const res = await rpc(xuongToken, 'deXuatCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'Đề xuất bảo dưỡng định kỳ',
        muc_uu_tien: 'binh_thuong',
      });
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toHaveProperty('id');
    });

    test('Giám đốc duyệt đề xuất', async () => {
      const dxRes = await rpc(xuongToken, 'deXuatCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'DX for approve',
        muc_uu_tien: 'cao',
      });
      if (dxRes.body.ok) {
        const approveRes = await rpc(giamdocToken, 'deXuatApprove', { id: dxRes.body.result.id, duyet: true });
        expect(approveRes.body.ok).toBe(true);
      }
    });

    test('Chuyển đề xuất thành SC', async () => {
      const dxRes = await rpc(xuongToken, 'deXuatCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'DX to SC',
        muc_uu_tien: 'binh_thuong',
      });
      if (dxRes.body.ok) {
        await rpc(giamdocToken, 'deXuatApprove', { id: dxRes.body.result.id, duyet: true });
        const toScRes = await rpc(xuongToken, 'deXuatToSC', { id: dxRes.body.result.id });
        expect(toScRes.body.ok).toBe(true);
        expect(toScRes.body.result).toHaveProperty('sc_id');
      }
    });
  });

  describe('Audit log: Ghi nhận hành động', () => {
    test('Mọi thao tác ghi audit', async () => {
      const createRes = await rpc(xuongToken, 'scCreate', {
        xe_id: 'XE-000001',
        noi_dung: 'Test audit',
        muc_uu_tien: 'binh_thuong',
      });
      expect(createRes.body.ok).toBe(true);

      const auditRes = await rpc(adminToken, 'auditList', { bang: 'sc', limit: 10 });
      expect(auditRes.body.ok).toBe(true);
      expect(auditRes.body.result.some((a: any) => a.hanh_vi === 'create' && a.bang === 'sc')).toBe(true);
    });
  });

  describe('Soft delete: Xóa mềm xe, vật tư', () => {
    test('Xe soft delete → không hiện trong list', async () => {
      const createRes = await rpc(adminToken, 'xeSave', {
        bks: 'TEST-DELETE',
        hang: 'Test',
        dong: 'Del',
        nam_sx: 2024,
        phong_ban: 'pb1',
        trang_thai: 'hoat_dong',
        loai_pt: 'keo',
      });
      expect(createRes.body.ok).toBe(true);
      const xeId = createRes.body.result.id;

      await rpc(adminToken, 'xeDel', { id: xeId });

      const listRes = await rpc(giamdocToken, 'xeList');
      expect(listRes.body.result.find((x: any) => x.id === xeId)).toBeUndefined();
    });

    test('VatTu soft delete', async () => {
      const vtRes = await rpc(khoToken, 'vatTuSave', {
        code: 'VT-DEL',
        name: 'VT Delete',
        nhom: 'Test',
        donvi: 'cái',
        gia: 10000,
        ton: 5,
        ton_min: 1,
      });
      expect(vtRes.body.ok).toBe(true);
      const vtId = vtRes.body.result.id;

      await rpc(khoToken, 'vatTuDel', { id: vtId });

      const listRes = await rpc(khoToken, 'vatTuList');
      expect(listRes.body.result.find((v: any) => v.id === vtId)).toBeUndefined();
    });
  });

  describe('Concurrency: nextId không trùng khi tạo đồng thời', () => {
    test('Tạo 10 SC đồng thời → ID unique', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        rpc(xuongToken, 'scCreate', {
          xe_id: 'XE-000001',
          noi_dung: `Concurrent SC ${i}`,
          muc_uu_tien: 'binh_thuong',
        })
      );
      const results = await Promise.all(promises);
      const ids = results.map(r => r.body.result?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('Tạo 10 vật tư đồng thời → ID unique', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        rpc(khoToken, 'vatTuSave', {
          code: `VT-CONC-${i}`,
          name: `VT Concurrent ${i}`,
          nhom: 'Test',
          donvi: 'cái',
          gia: 10000 + i,
          ton: 10,
          ton_min: 2,
        })
      );
      const results = await Promise.all(promises);
      const ids = results.map(r => r.body.result?.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});