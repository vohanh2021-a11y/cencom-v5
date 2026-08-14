/**
 * xuong.test.ts — Test Dashboard xưởng (port server/xuong.js v3.6).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as xuong from '../src/xuong.js';
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

describe('xuongDashboard', () => {
  it('thợ không có quyền xem dashboard', async () => {
    ctx.setActor({ id: 'tho-1', name: 'Thợ 1', role: 'tho' });
    await expect(xuong.xuongDashboardCached(ctx)).rejects.toThrow('Không đủ quyền');
  });

  it('trả cấu trúc cơ bản khi chưa có dữ liệu', async () => {
    const d = (await xuong.xuongDashboardCached(ctx)) as Record<string, any>;
    expect(d.today).toBeTruthy();
    expect(Array.isArray(d.tk.cho_xuong)).toBe(true);
    expect(Array.isArray(d.tk.dang_thuc_hien)).toBe(true);
    expect(Array.isArray(d.sc.dang_sua)).toBe(true);
    expect(Array.isArray(d.sc.cho_nghiem)).toBe(true);
    expect(Array.isArray(d.sc.hoan_hom_nay)).toBe(true);
    expect(Array.isArray(d.sc.quyet_toan_hom_nay)).toBe(true);
    expect(typeof d.tk.moi_hom_nay).toBe('number');
    expect(typeof d.tho.congviec_chua_tho).toBe('number');
    expect(Array.isArray(d.tho.congviec_theo_tho)).toBe(true);
    expect(Array.isArray(d.vattu_thieu)).toBe(true);
  });

  it('xuongDashboard nhìn thấy TK chờ xưởng sau khi xưởng nhận', async () => {
    const r = await tk.tkCreate(ctx, { bks: BKS, mo_ta: 'Test dashboard xuong', muc_uu_tien: 'Gap' });
    ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
    await tk.tkApprove(ctx, r.id!, 'ok');
    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    await tk.tkWorkshop(ctx, r.id!, 'ok');
    const d = (await xuong.xuongDashboardCached(ctx)) as Record<string, any>;
    const inList = (d.tk.cho_xuong as Array<Record<string, unknown>>).some((t) => t.id === r.id);
    expect(inList).toBe(true);
  });
});

describe('dashboardAll', () => {
  it('kế toán bị chặn', async () => {
    ctx.setActor({ id: 'ketoan-1', name: 'Kế toán', role: 'ketoan' });
    await expect(xuong.dashboardAllCached(ctx)).rejects.toThrow('Kế toán không xem');
  });

  it('thợ/khách bị chặn', async () => {
    ctx.setActor({ id: 'tho-1', name: 'Thợ 1', role: 'tho' });
    await expect(xuong.dashboardAllCached(ctx)).rejects.toThrow('Không đủ quyền');
  });

  it('quản lý xem được KPI + kanban', async () => {
    // Tạo SC để có card kanban
    const r = await sc.scCreate(ctx, { bks: BKS, mo_ta: 'SC kanban', congviec: [{ congviec_id: 1, so_luong: 1, don_gia: 1000000 }] });
    expect(r.ok).toBe(true);
    ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
    const d = (await xuong.dashboardAllCached(ctx)) as Record<string, any>;
    expect(d.kpi.xe).toBeGreaterThan(0);
    expect(d.kpi.sc_cho_duyet).toBeGreaterThan(0);
    expect(Array.isArray(d.cols)).toBe(true);
    expect(d.cols.length).toBe(5);
    expect(typeof d.baocao_thang.thang).toBe('string');
    const deXuatCol = (d.cols as Array<{ key: string; cards: unknown[] }>).find((c) => c.key === 'de_xuat');
    expect(deXuatCol!.cards.length).toBeGreaterThan(0);
    const card = deXuatCol!.cards[0] as Record<string, unknown>;
    expect(card.bks).toBe(BKS);
    expect(typeof card.phan_tram).toBe('number');
  });

  it('vnd format tiền', () => {
    expect(xuong.vnd(1234567)).toContain('đ');
    expect(xuong.vnd(0)).toBe('0 đ');
  });
});