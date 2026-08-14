/**
 * db.test.ts — Conformance tầng db (port db.js → db.ts):
 * nextId (FOR UPDATE + prefix), transaction commit/rollback, audit trong transaction,
 * softDelete/restoreRow, configGet/Set, xeByBks, usersList.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
}, 60000);

describe('db.nextId', () => {
  it('sinh mã PREFIX-000001 tăng dần', async () => {
    const a = await ctx.db.nextId('SC');
    const b = await ctx.db.nextId('SC');
    expect(a).toBe('SC-000001');
    expect(b).toBe('SC-000002');
  });

  it('các prefix độc lập nhau', async () => {
    const x = await ctx.db.nextId('KT');
    const y = await ctx.db.nextId('PN');
    expect(x).toBe('KT-000001');
    expect(y).toBe('PN-000001');
  });

  it('ghi counter vào bảng config', async () => {
    const v = await ctx.db.configGet('SC');
    expect(Number(v)).toBeGreaterThanOrEqual(2);
  });
});

describe('db.transaction', () => {
  it('COMMIT giữ dữ liệu', async () => {
    await ctx.db.transaction(async (tx) => {
      await tx.run("INSERT INTO xe(id, bks) VALUES('XE-TX1','99A-00001')");
    });
    const xe = await ctx.db.xeByBks('99A-00001');
    expect(xe).toBeDefined();
    expect(xe!.bks).toBe('99A-00001');
  });

  it('ROLLBACK khi lỗi — dữ liệu không tồn tại', async () => {
    await expect(
      ctx.db.transaction(async (tx) => {
        await tx.run("INSERT INTO xe(id, bks) VALUES('XE-TX2','99A-00002')");
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    const xe = await ctx.db.xeByBks('99A-00002');
    expect(xe).toBeUndefined();
  });

  it('audit ghi TRONG transaction được commit', async () => {
    await ctx.db.transaction(async (tx) => {
      await tx.run("INSERT INTO xe(id, bks) VALUES('XE-TX3','99A-00003')");
      await tx.audit('test', 'xe', 'XE-TX3', 'tester', 'audit trong tx');
    });
    const audits = await ctx.db.auditList({ bang: 'xe', nguoi: 'tester' });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
});

describe('db.softDelete / restoreRow', () => {
  it('soft-delete set deleted_at + ghi audit', async () => {
    await ctx.db.softDelete('congviec', 'id', 1, 'admin-1');
    const row = await ctx.db.row<{ deleted_at: string }>('SELECT deleted_at FROM congviec WHERE id=1');
    expect(row!.deleted_at).not.toBe('');
    await ctx.db.restoreRow('congviec', 'id', 1, 'admin-1');
    const restored = await ctx.db.row<{ deleted_at: string }>('SELECT deleted_at FROM congviec WHERE id=1');
    expect(restored!.deleted_at).toBe('');
  });

  it('chặn tên bảng/cột không hợp lệ (chống SQLi)', async () => {
    await expect(ctx.db.softDelete('congviec; DROP TABLE xe', 'id', 1, 'admin-1')).rejects.toThrow();
  });
});

describe('db.config', () => {
  it('configGet mặc định rỗng / configSet đọc lại', async () => {
    const def = await ctx.db.configGet('khong_co_key_nay', 'FALLBACK');
    expect(def).toBe('FALLBACK');
    await ctx.db.configSet('test_key', '123');
    expect(await ctx.db.configGet('test_key')).toBe('123');
  });
});

describe('db.helpers', () => {
  it('xeByBks không phân biệt hoa thường', async () => {
    const xe = await ctx.db.xeByBks('37h-09917');
    expect(xe).toBeDefined();
    expect(xe!.bks.toUpperCase()).toBe('37H-09917');
  });

  it('usersList lọc theo role', async () => {
    const laixes = await ctx.db.usersList('laixe');
    expect(laixes.length).toBeGreaterThan(0);
    expect(laixes.every((u) => u.role === 'laixe')).toBe(true);
  });
});