import { adminToken, giamdocToken, xuongToken, ketoanToken, khoToken, db } from './setup';
import { dispatchRpc } from '@cencom/web/lib/rpc-dispatch';
import { current, setUser } from '@cencom/core';

const ROLES = [
  { token: 'adminToken', name: 'admin', role: 'admin' },
  { token: 'giamdocToken', name: 'giamdoc', role: 'giamdoc' },
  { token: 'xuongToken', name: 'xuong', role: 'xuong' },
  { token: 'ketoanToken', name: 'ketoan', role: 'ketoan' },
  { token: 'khoToken', name: 'kho', role: 'kho' },
];

const TOKENS: Record<string, string> = {
  adminToken: adminToken,
  giamdocToken: giamdocToken,
  xuongToken: xuongToken,
  ketoanToken: ketoanToken,
  khoToken: khoToken,
};

const actors: Record<string, { id: string; name: string; role: string }> = {
  admin: { id: 'U-ADMIN', name: 'admin', role: 'admin' },
  giamdoc: { id: 'U-GIAMDOC', name: 'giamdoc', role: 'giamdoc' },
  xuong: { id: 'U-XUONG', name: 'xuong', role: 'xuong' },
  ketoan: { id: 'U-KETOAN', name: 'ketoan', role: 'ketoan' },
  kho: { id: 'U-KHO', name: 'kho', role: 'kho' },
};

function getToken(role: string): string {
  return TOKENS[`${role}Token`];
}

function directRpc(fn: string, args: any = {}, role: string = 'admin') {
  setUser(actors[role]);
  return dispatchRpc(fn, [args], actors[role], db);
}

const RPC_FNS = [
  // Auth
  { fn: 'login', public: true, expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'logout', public: true, expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'currentUser', public: true, expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'appInfo', public: true, expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'changePassword', public: true, expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },

  // Xe
  { fn: 'xeList', module: 'xe', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'xeGet', module: 'xe', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'xeSave', module: 'xe', feature: 'sua', expectedRoles: ['admin'] },
  { fn: 'xeReminders', module: 'xe', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },

  // SC
  { fn: 'scList', module: 'sc', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'scGet', module: 'sc', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'scCreate', module: 'sc', feature: 'tao', expectedRoles: ['admin', 'xuong'] },
  { fn: 'scApprove', module: 'sc', feature: 'duy', expectedRoles: ['admin', 'giamdoc'] },
  { fn: 'scStart', module: 'sc', feature: 'sua', expectedRoles: ['admin', 'xuong'] },
  { fn: 'scFinish', module: 'sc', feature: 'sua', expectedRoles: ['admin', 'xuong'] },
  { fn: 'scNghiem', module: 'sc', feature: 'duy', expectedRoles: ['admin', 'giamdoc'] },
  { fn: 'scTongDuyet', module: 'sc', feature: 'duy', expectedRoles: ['admin', 'giamdoc'] },
  { fn: 'scWorkAdd', module: 'sc', feature: 'sua', expectedRoles: ['admin', 'xuong'] },
  { fn: 'scVtAdd', module: 'sc', feature: 'sua', expectedRoles: ['admin', 'xuong'] },

  // Kho
  { fn: 'vatTuList', module: 'kho', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'vatTuSave', module: 'kho', feature: 'tao', expectedRoles: ['admin', 'kho'] },
  { fn: 'vatTuDel', module: 'kho', feature: 'xoa', expectedRoles: ['admin', 'kho'] },
  { fn: 'tonKho', module: 'kho', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'phNhapCreate', module: 'kho', feature: 'tao', expectedRoles: ['admin', 'kho'] },
  { fn: 'phXuatCreate', module: 'kho', feature: 'xuat', expectedRoles: ['admin', 'kho'] },
  { fn: 'phNhapList', module: 'kho', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'phXuatList', module: 'kho', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },

  // Mua
  { fn: 'dmList', module: 'mua', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
  { fn: 'dmCreate', module: 'mua', feature: 'tao', expectedRoles: ['admin', 'ketoan'] },
  { fn: 'dmDecide', module: 'mua', feature: 'duy', expectedRoles: ['admin', 'ketoan'] },

  // Ke toan
  { fn: 'ledgerList', module: 'ke_toan', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'ketoan'] },
  { fn: 'ledgerPost', module: 'ke_toan', feature: 'tao', expectedRoles: ['admin', 'ketoan'] },
  { fn: 'vatInvoiceSave', module: 'ke_toan', feature: 'vat', expectedRoles: ['admin', 'ketoan'] },
  { fn: 'phieuChiCreate', module: 'ke_toan', feature: 'chi', expectedRoles: ['admin', 'ketoan'] },
  { fn: 'congNoList', module: 'ke_toan', feature: 'xem', expectedRoles: ['admin', 'ketoan'] },
  { fn: 'kyClose', module: 'ke_toan', feature: 'ky', expectedRoles: ['admin', 'ketoan'] },

  // Bao gia
  { fn: 'baoGiaList', module: 'mua', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'ketoan', 'kho'] },
  { fn: 'baoGiaCreate', module: 'mua', feature: 'tao', expectedRoles: ['admin', 'ketoan'] },

  // Ho so
  { fn: 'hoSoGet', module: 'hoso', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'ketoan', 'xuong', 'kho'] },
  { fn: 'hoSoList', module: 'hoso', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'ketoan', 'xuong', 'kho'] },
  { fn: 'hoSoSave', module: 'hoso', feature: 'tao', expectedRoles: ['admin', 'ketoan'] },

  // Admin only
  { fn: 'userAdd', adminOnly: true, expectedRoles: ['admin'] },
  { fn: 'userSetPassword', adminOnly: true, expectedRoles: ['admin'] },
  { fn: 'userSetActive', adminOnly: true, expectedRoles: ['admin'] },
  { fn: 'permMatrix', adminOnly: true, expectedRoles: ['admin'] },
  { fn: 'permSave', adminOnly: true, expectedRoles: ['admin'] },
  { fn: 'thresholdsSet', adminOnly: true, expectedRoles: ['admin'] },
  { fn: 'auditList', adminOnly: true, expectedRoles: ['admin'] },

  // Role restricted
  { fn: 'activityFeed', roleRestrict: ['admin', 'giamdoc'], expectedRoles: ['admin', 'giamdoc'] },
  { fn: 'scHoSoXlsx', roleRestrict: ['admin', 'giamdoc', 'ketoan'], expectedRoles: ['admin', 'giamdoc', 'ketoan'] },

  // Xuong
  { fn: 'xuongDashboard', module: 'xuong', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong'] },
  { fn: 'dashboardAll', module: 'xuong', feature: 'xem', expectedRoles: ['admin', 'giamdoc', 'xuong'] },
];

describe('RBAC Permission Matrix (5 roles × 32+ fn = 160+ cases)', () => {
  for (const { fn, module, feature, adminOnly, roleRestrict, expectedRoles } of RPC_FNS) {
    for (const r of ROLES) {
      const shouldAllow = expectedRoles.includes(r.role);
      const testName = `${fn} as ${r.role} ${shouldAllow ? '→ ALLOW' : '→ DENY'}`;

      test(testName, async () => {
        const token = getToken(r.role);
        if (!token) {
          console.warn(`No token for role ${r.role}, skipping`);
          return;
        }

        const res = await request('http://localhost:3000')
          .post('/api/rpc')
          .set('Cookie', [`sid=${token}`])
          .send({ fn, args: {} });

        if (shouldAllow) {
          // Should not be permission denied (may fail for other reasons like missing args)
          expect(res.body.ok).not.toBe(false);
          if (!res.body.ok && res.body.error) {
            expect(res.body.error).not.toContain('Không có quyền');
            expect(res.body.error).not.toContain('chức năng này');
            expect(res.body.error).not.toContain('giới hạn quyền');
          }
        } else {
          // Should be denied
          expect(res.body.ok).toBe(false);
          expect(res.body.error).toBeDefined();
          const denied = res.body.error.includes('Không có quyền') ||
            res.body.error.includes('chức năng này') ||
            res.body.error.includes('giới hạn quyền');
          expect(denied).toBe(true);
        }
      });
    }
  }
});

describe('Direct RPC dispatch with perm.can', () => {
  for (const r of ROLES) {
    test(`perm.can for ${r.role} on sc.xem`, async () => {
      const allowed = await (await import('@cencom/core')).perm.can(db, r.role, 'sc', 'xem');
      const expected = expectedRolesForModuleFeature('sc', 'xem').includes(r.role);
      expect(allowed).toBe(expected);
    });

    test(`perm.can for ${r.role} on kho.xuat`, async () => {
      const allowed = await (await import('@cencom/core')).perm.can(db, r.role, 'kho', 'xuat');
      const expected = expectedRolesForModuleFeature('kho', 'xuat').includes(r.role);
      expect(allowed).toBe(expected);
    });
  }
});

function expectedRolesForModuleFeature(module: string, feature: string): string[] {
  const matrix = (await import('@cencom/core/src/perm.js')).MATRIX;
  const roles: string[] = [];
  for (const [role, mods] of Object.entries(matrix)) {
    if (mods[module] && mods[module].includes(feature)) {
      roles.push(role);
    }
    if (mods.all && mods.all.includes('all')) {
      roles.push(role);
    }
  }
  return roles;
}