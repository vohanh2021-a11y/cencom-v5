/**
 * nhanKy.test.ts — Test Chữ ký (port server/nhanKy.js v3.6).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as nhanKy from '../src/nhanKy.js';

const BKS = '37H-09917';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

describe('nhanKyList / nhanKySet', () => {
  it('danh sách rỗng khi chưa có chữ ký', async () => {
    const list = await nhanKy.nhanKyList(ctx, 'phieu_sua', 'SC-001');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  it('thêm chữ ký mới (nguoi_lap) + cập nhật lại', async () => {
    await nhanKy.nhanKySet(ctx, 'phieu_sua', 'SC-002', [
      { vi_tri: 'nguoi_lap', nguoi_ky: 'Nguyễn Văn A', chu_ky_data: '' },
    ]);
    const list = await nhanKy.nhanKyList(ctx, 'phieu_sua', 'SC-002');
    expect(list.length).toBe(1);
    expect(list[0]!.vi_tri).toBe('nguoi_lap');
    expect(list[0]!.vi_tri_label).toBe('Người lập');
    expect(list[0]!.nguoi_ky).toBe('Nguyễn Văn A');

    // Cập nhật lại cùng vị trí
    await nhanKy.nhanKySet(ctx, 'phieu_sua', 'SC-002', [
      { vi_tri: 'nguoi_lap', nguoi_ky: 'Nguyễn Văn B', chu_ky_data: 'base64sig' },
    ]);
    const list2 = await nhanKy.nhanKyList(ctx, 'phieu_sua', 'SC-002');
    expect(list2.length).toBe(1);
    expect(list2[0]!.nguoi_ky).toBe('Nguyễn Văn B');
    expect(list2[0]!.chu_ky_data).toBe('base64sig');
  });

  it('thêm nhiều vị trí cùng lúc', async () => {
    await nhanKy.nhanKySet(ctx, 'phieu_sua', 'SC-003', [
      { vi_tri: 'thu_kho', nguoi_ky: 'Trần Thị C' },
      { vi_tri: 'lai_xe', nguoi_ky: 'Lê Văn D', chu_ky_data: 'sig123' },
      { vi_tri: 'giam_doc', nguoi_ky: 'Giám đốc E' },
    ]);
    const list = await nhanKy.nhanKyList(ctx, 'phieu_sua', 'SC-003');
    expect(list.length).toBe(3);
    const labels = list.map((x) => x.vi_tri_label).sort();
    expect(labels).toEqual(['Giám đốc', 'Lái xe', 'Thủ kho']);
  });

  it('thiếu mảng patches → l��i', async () => {
    const r = await nhanKy.nhanKySet(ctx, 'phieu_sua', 'SC-004', []);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Thiếu chữ ký');
  });

  it('kế toán/kho không có quyền sc.sua → l��i', async () => {
    ctx.setActor({ id: 'khoa-1', name: 'Kho', role: 'khoa' });
    await expect(nhanKy.nhanKySet(ctx, 'phieu_sua', 'SC-005', [
      { vi_tri: 'nguoi_lap', nguoi_ky: 'Kho' },
    ])).rejects.toThrow('Không đủ quyền');
  });
});