/**
 * perm.test.ts — Conformance phân quyền (port perm.js → perm.ts):
 * MATRIX seed, can() đọc DB + fallback MATRIX, admin toàn quyền,
 * ngưỡng duyệt SC/Mua theo config, savePerms, permsOfRole/allPerms.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import { seedPerms, can, permsOfRole, allPerms, savePerms, scNguong, muaNguong, canApproveSC, canApproveMua, canQuyetToan, MATRIX } from '../src/perm.js';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
}, 60000);

describe('perm.seedPerms + can', () => {
  it('seedPerms gieo MATRIX + admin all/all', async () => {
    await seedPerms(ctx.db);
    expect(await can(ctx.db, 'admin', 'sc', 'xem')).toBe(true);
    expect(await can(ctx.db, 'tho', 'sc', 'tao')).toBe(true);
    expect(await can(ctx.db, 'tho', 'sc', 'duy')).toBe(false);
    expect(await can(ctx.db, 'laixe', 'tk', 'tao')).toBe(true);
    expect(await can(ctx.db, 'laixe', 'kho', 'xem')).toBe(false);
  });

  it('can() fallback MATRIX khi DB chưa có dòng', async () => {
    await ctx.db.run("DELETE FROM phan_quyen WHERE role='xuong' AND module='sc' AND feature='sua'");
    // xoá khỏi DB → fallback MATRIX vẫn cho phép
    expect(await can(ctx.db, 'xuong', 'sc', 'sua')).toBe(true);
  });
});

describe('perm ngưỡng duyệt', () => {
  it('config ngưỡng SC/Mua đọc từ DB (seed = 5.000.000)', async () => {
    expect(await scNguong(ctx.db)).toBe(5000000);
    expect(await muaNguong(ctx.db)).toBe(5000000);
  });

  it('canApproveSC: giamdoc/admin luôn duyệt; quanly theo ngưỡng', async () => {
    expect(await canApproveSC(ctx.db, 'giamdoc', 999999999)).toBe(true);
    expect(await canApproveSC(ctx.db, 'admin', 999999999)).toBe(true);
    expect(await canApproveSC(ctx.db, 'quanly', 5000000)).toBe(true);
    expect(await canApproveSC(ctx.db, 'quanly', 5000001)).toBe(false);
    expect(await canApproveSC(ctx.db, 'tho', 1000)).toBe(false);
  });

  it('canApproveMua: giamdoc/admin luôn; ketoan theo ngưỡng', async () => {
    expect(await canApproveMua(ctx.db, 'ketoan', 5000000)).toBe(true);
    expect(await canApproveMua(ctx.db, 'ketoan', 5000001)).toBe(false);
    expect(await canApproveMua(ctx.db, 'giamdoc', 999999999)).toBe(true);
  });

  it('canQuyetToan: admin/ketoan/giamdoc/quanly', () => {
    expect(canQuyetToan('admin')).toBe(true);
    expect(canQuyetToan('ketoan')).toBe(true);
    expect(canQuyetToan('quanly')).toBe(true);
    expect(canQuyetToan('giamdoc')).toBe(true);
    expect(canQuyetToan('tho')).toBe(false);
    expect(canQuyetToan('laixe')).toBe(false);
  });
});

describe('perm.savePerms + permsOfRole', () => {
  it('savePerms thêm/xoá quyền + audit', async () => {
    const r1 = await savePerms(ctx.db, [{ role: 'tho', module: 'report', feature: 'duy', on: true }], ctx.auth);
    expect(r1.ok).toBe(true);
    expect(await can(ctx.db, 'tho', 'report', 'duy')).toBe(true);
    const r2 = await savePerms(ctx.db, [{ role: 'tho', module: 'report', feature: 'duy', on: false }], ctx.auth);
    expect(r2.ok).toBe(true);
    expect(await can(ctx.db, 'tho', 'report', 'duy')).toBe(false);
  });

  it('permsOfRole admin → { all: [all] }', async () => {
    expect(await permsOfRole(ctx.db, 'admin')).toEqual({ all: ['all'] });
  });

  it('allPerms có đủ 8 vai', async () => {
    const all = await allPerms(ctx.db);
    expect(Object.keys(all).length).toBe(8);
    expect(all.admin).toEqual({ all: ['all'] });
  });

  it('MATRIX export đúng cấu trúc', () => {
    expect(MATRIX.tho!.sc).toContain('sua');
    expect(MATRIX.laixe!.tk).toContain('tao');
  });
});