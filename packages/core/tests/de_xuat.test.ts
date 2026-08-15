/**
 * de_xuat.test.ts — Test module Đề xuất sửa chữa (thay thế tk.test.ts).
 * Port luồng: xưởng tạo (cho_duyet) → quản lý/giám đốc duyệt (da_duyet/tu_choi)
 * → xưởng tạo phiếu sửa chữa (da_chuyen_sc, liên kết de_xuat_id).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as deXuat from '../src/de_xuat.js';
import * as sc from '../src/sc.js';

const BKS = '37H-09917';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
}, 60000);

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

async function makeDX() {
  const r = await deXuat.deXuatCreate(ctx, {
    bks: BKS,
    mo_ta: 'Máy nổ rung, hộp số kêu khi lên dốc',
    dau_hieu: ['rung_vo_lang', 'hop_so_keu'],
    muc_uu_tien: 'Khan_cap',
  });
  return r;
}

describe('deXuat tạo + danh sách + chi tiết', () => {
  it('deXuatCreate tạo đề xuất + audit + nhật ký', async () => {
    const r = await makeDX();
    expect(r.ok).toBe(true);
    expect(r.id).toMatch(/^DX-/);
    const d = await deXuat.deXuatGet(ctx, r.id!);
    expect(d && typeof d === 'object' && !('ok' in d && (d as { ok?: boolean }).ok === false)).toBe(true);
    const rec = d as Record<string, unknown>;
    expect(rec.trang_thai).toBe('cho_duyet');
    expect(rec.muc_uu_tien_label).toBe('Khẩn cấp');
    expect(rec.xe).toBeTruthy();
  });

  it('deXuatCreate thiếu mô tả → lỗi', async () => {
    const r = await deXuat.deXuatCreate(ctx, { bks: BKS });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('mô tả');
  });

  it('deXuatCreate thiếu biển số → lỗi', async () => {
    const r = await deXuat.deXuatCreate(ctx, { mo_ta: 'Không có biển số' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('biển số');
  });

  it('deXuatCreate xe chưa có → lỗi', async () => {
    const r = await deXuat.deXuatCreate(ctx, { bks: '99Z-99999', mo_ta: 'Xe ma' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Chưa có xe');
  });

  it('deXuatList filter + xưởng chỉ thấy của mình', async () => {
    const r = await makeDX();
    const list = await deXuat.deXuatList(ctx, { bks: BKS });
    expect(list.length).toBeGreaterThan(0);
    // chuyển sang xuong (chỉ thấy đề xuất do mình tạo, tên 'Quản lý xưởng')
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    const mine = await deXuat.deXuatList(ctx, {});
    expect(Array.isArray(mine)).toBe(true);
    // đề xuất vừa tạo do admin tạo (name 'Admin'), xưởng không thấy
    expect(mine.find((x) => x.id === r.id)).toBeUndefined();
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });
});

describe('deXuatApprove — quản lý/giám đốc duyệt', () => {
  it('deXuatApprove ok/từ chối + trạng thái sai → lỗi', async () => {
    const r = await makeDX();
    ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
    const ap = await deXuat.deXuatApprove(ctx, r.id!, 'ok');
    expect(ap.ok).toBe(true);
    expect(ap.trang_thai).toBe('da_duyet');
    const again = await deXuat.deXuatApprove(ctx, r.id!, 'ok');
    expect(again.ok).toBe(false);
    expect(again.error).toContain('trạng thái');
  });

  it('deXuatApprove thiếu quyền (khoa) → throw', async () => {
    const r = await makeDX();
    ctx.setActor({ id: 'khoa-1', name: 'Thủ kho', role: 'khoa' });
    await expect(deXuat.deXuatApprove(ctx, r.id!, 'ok')).rejects.toThrow('Không đủ quyền');
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });
});

describe('deXuatToSC — tạo phiếu sửa chữa từ đề xuất', () => {
  it('duyệt → tạo SC liên kết de_xuat_id', async () => {
    const r = await makeDX();
    ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
    await deXuat.deXuatApprove(ctx, r.id!, 'ok');
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    const created = await deXuat.deXuatToSC(ctx, r.id!, {
      congviec: [{ congviec_id: 1, so_luong: 1, don_gia: 1200000 }],
    });
    expect(created.ok).toBe(true);
    expect(created.sc_id).toMatch(/^SC-/);
    // tạo lần 2 → lỗi đã có
    const again = await deXuat.deXuatToSC(ctx, r.id!, {});
    expect(again.ok).toBe(false);
    expect(again.error).toContain('đã có phiếu sửa chữa');
    // SC có de_xuat_id
    const d = await sc.scGet(ctx, created.sc_id!);
    expect(d!.sc.de_xuat_id).toBe(r.id);
    // trạng thái đề xuất chuyển da_chuyen_sc — cần admin để xem DX do admin tạo
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
    const dx = await deXuat.deXuatGet(ctx, r.id!) as Record<string, unknown>;
    expect(dx.trang_thai).toBe('da_chuyen_sc');
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });

  it('deXuatToSC chưa duyệt → lỗi', async () => {
    const r = await makeDX();
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    const bad = await deXuat.deXuatToSC(ctx, r.id!, {});
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('chưa được duyệt');
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });
});
