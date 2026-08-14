/**
 * baogia.test.ts — Test Báo giá NCC (port server/baogia.js v3.6, đã sửa v4).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as baogia from '../src/baogia.js';

const BKS = '37H-09917';

let ctx: TestCtx;
let sc: typeof import('../src/sc.js');
let kho: typeof import('../src/kho.js');

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  sc = await import('../src/sc.js');
  kho = await import('../src/kho.js');
});

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

describe('baoGiaList / baoGiaGet', () => {
  it('danh sách trống khi chưa có dữ liệu', async () => {
    const list = await baogia.baoGiaList(ctx, {});
    expect(Array.isArray(list)).toBe(true);
  });

  it('baoGiaGet không tồn tại → null', async () => {
    const b = await baogia.baoGiaGet(ctx, 999999);
    expect(b).toBeNull();
  });
});

describe('baoGiaCreate', () => {
  it('thiếu ncc_ten → l��i', async () => {
    const r = await baogia.baoGiaCreate(ctx, { ncc_dia_chi: 'Địa chỉ', sc_id: 'SC-001' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ncc_ten');
  });

  it('tạo báo giá gắn SC + cập nhật SC de_xuat → da_duyet', async () => {
    // Tạo SC trực tiếp qua DB để tránh circular dependency module sc
    const scId = await ctx.db.nextId('SC');
    await ctx.db.run(
      "INSERT INTO phieu_sua(id, bks, mo_ta, ngay, trang_thai, nguoi_lap, tong) VALUES($1,$2,$3,$4,'de_xuat',$5,0)",
      scId, BKS, 'SC cho báo giá', ctx.db.today(), 'admin'
    );

    const bg = await baogia.baoGiaCreate(ctx, {
      ncc_ten: 'NCC Tùng Lâm',
      ncc_dia_chi: 'Hà Nội',
      ncc_sdt: '0909123456',
      sc_id: scId,
      loai_chung_tu: 'bao_gia',
    });
    expect(bg.ok).toBe(true);
    expect(typeof bg.id).toBe('number');

    const sc = await ctx.db.row<{ trang_thai: string }>('SELECT trang_thai FROM phieu_sua WHERE id=$1', scId);
    expect(sc!.trang_thai).toBe('da_duyet');
  });

  it('tạo báo giá gắn dm_id (đã có DM items)', async () => {
    const dm = await kho.dmCreate(ctx, {
      items: [{ vattu_id: 1, so_luong: 2, dgia: 30000 }],
      ghi_chu: 'DM cho báo giá',
    });
    expect(dm.ok).toBe(true);
    const bg = await baogia.baoGiaCreate(ctx, {
      ncc_ten: 'NCC Kim Cương',
      dm_id: dm.id!,
    });
    expect(bg.ok).toBe(true);
  });

  it('tạo báo giá với items trực tiếp → tự tạo DM', async () => {
    const bg = await baogia.baoGiaCreate(ctx, {
      ncc_ten: 'NCC Tự Tạo DM',
      items: [{ vattu_id: 1, ten: 'Vật tư A', donvi: 'cái', so_luong: 1, dgia: 10000 }],
    });
    expect(bg.ok).toBe(true);
    // DM được tạo và gắn vào báo giá
    const b = await baogia.baoGiaGet(ctx, bg.id!);
    expect(b!.dm_id).toBeTruthy();
  });
});

describe('baoGiaConfirm', () => {
  it('cập nhật thông tin NCC', async () => {
    const bg = await baogia.baoGiaCreate(ctx, { ncc_ten: 'NCC Chưa Xác Nhận' });
    expect(bg.ok).toBe(true);
    const cf = await baogia.baoGiaConfirm(ctx, bg.id!, { ncc_ten: 'NCC Đã Xác Nhận', ncc_dia_chi: 'HCM' });
    expect(cf.ok).toBe(true);
    const b = await baogia.baoGiaGet(ctx, bg.id!);
    expect(b!.ncc_ten).toBe('NCC Đã Xác Nhận');
    expect(b!.ncc_dia_chi).toBe('HCM');
  });

  it('không tồn tại → l��i', async () => {
    const cf = await baogia.baoGiaConfirm(ctx, 999999, { ncc_ten: 'X' });
    expect(cf.ok).toBe(false);
    expect(cf.error).toContain('Không thấy');
  });
});

describe('baoGiaOcr', () => {
  it('stub trả l��i đã bỏ v4', async () => {
    const r = await baogia.baoGiaOcr(ctx, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('đã bỏ ở v4');
  });
});

describe('baoGiaDel', () => {
  it('xóa m��m báo giá', async () => {
    const bg = await baogia.baoGiaCreate(ctx, { ncc_ten: 'NCC Sẽ Xóa' });
    expect(bg.ok).toBe(true);
    const del = await baogia.baoGiaDel(ctx, bg.id!);
    expect(del.ok).toBe(true);
    const b = await baogia.baoGiaGet(ctx, bg.id!);
    expect(b).toBeNull();
  });
});