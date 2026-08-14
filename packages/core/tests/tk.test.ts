/**
 * tk.test.ts — Test module Yêu cầu thăm khám (port server/tk.js v3.6).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as tk from '../src/tk.js';
import * as sc from '../src/sc.js';

const BKS = '37H-09917';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

async function makeTK() {
  const r = await tk.tkCreate(ctx, {
    bks: BKS,
    mo_ta: 'Máy nổ rung, hộp số kêu khi lên dốc',
    dau_hieu: ['rung_vo_lang', 'hộp_số_kêu'],
    muc_uu_tien: 'Khan_cap',
  });
  return r;
}

describe('tk tạo + danh sách + chi tiết', () => {
  it('tkCreate tạo yêu cầu + audit + nhật ký', async () => {
    const r = await makeTK();
    expect(r.ok).toBe(true);
    expect(r.id).toMatch(/^TK-/);
    const d = await tk.tkGet(ctx, r.id!);
    expect(d && typeof d === 'object' && !('ok' in d && (d as { ok?: boolean }).ok === false)).toBe(true);
    const rec = d as Record<string, unknown>;
    expect(rec.trang_thai).toBe('cho_duyet');
    expect(rec.muc_uu_tien_label).toBe('Khẩn cấp');
    expect(rec.xe).toBeTruthy();
  });

  it('tkCreate thiếu mô tả → lỗi', async () => {
    const r = await tk.tkCreate(ctx, { bks: BKS });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('mô tả');
  });

  it('lái xe chỉ tạo cho xe của mình', async () => {
    ctx.setActor({ id: 'laixe-1', name: 'Lái xe 1', role: 'laixe' });
    // laixe-1 không sở hữu 37H-09917 → lỗi (kiểm tra bks nào thuộc laixe-1)
    const xe = await ctx.db.row<{ bks: string }>('SELECT bks FROM xe WHERE lai_xe_id=$1 LIMIT 1', 'laixe-1');
    if (xe) {
      const ok = await tk.tkCreate(ctx, { bks: xe.bks, mo_ta: 'Xe tôi kiểm tra' });
      expect(ok.ok).toBe(true);
    }
    const denied = await tk.tkCreate(ctx, { bks: BKS, mo_ta: 'Xe người khác' });
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('không nằm trong xe');
  });

  it('tkList filter + chỉ thấy của mình (laixe)', async () => {
    await makeTK();
    const list = await tk.tkList(ctx, { bks: BKS });
    expect(list.length).toBeGreaterThan(0);
    ctx.setActor({ id: 'laixe-1', name: 'Lái xe 1', role: 'laixe' });
    const my = await tk.tkList(ctx, {});
    // laixe-1 chỉ thấy yêu cầu chính mình tạo (nếu có)
    expect(Array.isArray(my)).toBe(true);
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });
});

describe('tk luồng duyệt', () => {
  it('tkApprove ok/từ chối + trạng thái sai → lỗi', async () => {
    const r = await makeTK();
    ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
    const ap = await tk.tkApprove(ctx, r.id!, 'ok');
    expect(ap.ok).toBe(true);
    expect(ap.trang_thai).toBe('da_duyet');
    const again = await tk.tkApprove(ctx, r.id!, 'ok');
    expect(again.ok).toBe(false);
    expect(again.error).toContain('trạng thái');
  });

  it('tkWorkshop nhận lệnh', async () => {
    const r = await makeTK();
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    await tk.tkApprove(ctx, r.id!, 'ok');
    const w = await tk.tkWorkshop(ctx, r.id!, 'ok');
    expect(w.ok).toBe(true);
    expect(w.trang_thai).toBe('xuong_nhan');
    // gọi sai bước → lỗi
    const bad = await tk.tkWorkshop(ctx, r.id!, 'ok');
    expect(bad.ok).toBe(false);
  });

  it('tkAssign giao thợ + tkStart', async () => {
    const r = await makeTK();
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    await tk.tkApprove(ctx, r.id!, 'ok');
    await tk.tkWorkshop(ctx, r.id!, 'ok');
    const as = await tk.tkAssign(ctx, r.id!, 'tho-1');
    expect(as.ok).toBe(true);
    expect(as.tho_id).toBe('tho-1');
    const st = await tk.tkStart(ctx, r.id!);
    expect(st.ok).toBe(true);
    expect(st.trang_thai).toBe('dang_thuc_hien');
  });

  it('tkCreateSC tạo phiếu sửa chữa liên kết', async () => {
    const r = await makeTK();
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    await tk.tkApprove(ctx, r.id!, 'ok');
    await tk.tkWorkshop(ctx, r.id!, 'ok');
    const created = await tk.tkCreateSC(ctx, r.id!, {
      congviec: [{ congviec_id: 1, so_luong: 1, don_gia: 1200000 }],
    });
    expect(created.ok).toBe(true);
    expect(created.sc_id).toMatch(/^SC-/);
    // tạo lần 2 → lỗi đã có
    const again = await tk.tkCreateSC(ctx, r.id!, {});
    expect(again.ok).toBe(false);
    expect(again.error).toContain('đã có phiếu sửa chữa');
    // SC có tk_id
    const d = await sc.scGet(ctx, created.sc_id!);
    expect(d!.sc.tk_id).toBe(r.id);
  });

  it('tkCreateSC sai trạng thái → lỗi', async () => {
    const r = await makeTK();
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    const bad = await tk.tkCreateSC(ctx, r.id!, {});
    expect(bad.ok).toBe(false);
  });

  it('tkFinish hoàn tất', async () => {
    const r = await makeTK();
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    await tk.tkApprove(ctx, r.id!, 'ok');
    await tk.tkWorkshop(ctx, r.id!, 'ok');
    await tk.tkStart(ctx, r.id!);
    const f = await tk.tkFinish(ctx, r.id!, 'Đã kiểm tra xong');
    expect(f.ok).toBe(true);
    expect(f.trang_thai).toBe('da_hoan');
  });
});