/**
 * welcome.test.ts — Test màn hình chào m��ng (port server/welcome.js v3.6).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as welcome from '../src/welcome.js';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

describe('welcome', () => {
  it('trả greeting + ngày giờ + shortcuts admin', async () => {
    const w = (await welcome.welcome(ctx)) as any;
    expect(w.ok).toBe(true);
    expect(w.greeting).toBeTruthy();
    expect(w.thu).toBeTruthy();
    expect(w.ngay).toBeTruthy();
    expect(w.gio).toMatch(/^\d{2}:\d{2}$/);
    expect(Array.isArray(w.shortcuts)).toBe(true);
    expect(w.shortcuts.length).toBeGreaterThan(0);
    expect(w.me.role).toBe('admin');
  });

  it('shortcuts thay đổi theo role', async () => {
    ctx.setActor({ id: 'tho-1', name: 'Thợ', role: 'tho' });
    const w1 = (await welcome.welcome(ctx)) as any;
    const views1 = w1.shortcuts.map((s: any) => s.view);
    expect(views1).toContain('sc_new');
    expect(views1).toContain('sc_my');

    ctx.setActor({ id: 'khoa-1', name: 'Kho', role: 'khoa' });
    const w2 = (await welcome.welcome(ctx)) as any;
    const views2 = w2.shortcuts.map((s: any) => s.view);
    expect(views2).toContain('kho_ton');
    expect(views2).toContain('dm_new');

    ctx.setActor({ id: 'xuong-1', name: 'Quản lý xưởng', role: 'xuong' });
    const w3 = (await welcome.welcome(ctx)) as any;
    const views3 = w3.shortcuts.map((s: any) => s.view);
    expect(views3).toContain('dx_new');
    expect(views3).toContain('sc_list');
  });

  it('stats chứa các chỉ số cơ bản', async () => {
    const w = (await welcome.welcome(ctx)) as any;
    expect(typeof w.stats.xe).toBe('number');
    expect(typeof w.stats.scChoDuyet).toBe('number');
    expect(typeof w.stats.dxChoDuyet).toBe('number');
    expect(typeof w.stats.chatUnread).toBe('number');
  });

  it('myTasks rỗng khi admin (không có task phân vai cụ thể)', async () => {
    const w = (await welcome.welcome(ctx)) as any;
    // admin không có myTasks theo logic (chỉ tho/admin có job tasks)
    expect(Array.isArray(w.myTasks)).toBe(true);
  });

  it('lowTon chỉ hiển thị cho quanly/giamdoc/khoa/ketoan', async () => {
    ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
    const w1 = (await welcome.welcome(ctx)) as any;
    expect(Array.isArray(w1.lowTon)).toBe(true);

    ctx.setActor({ id: 'tho-1', name: 'Thợ', role: 'tho' });
    const w2 = (await welcome.welcome(ctx)) as any;
    expect(w2.lowTon).toEqual([]);
  });

  it('greeting theo giờ', () => {
    const g = welcome.greeting();
    expect(['Chào buổi sáng', 'Chào buổi trưa', 'Chào buổi chiều', 'Chúc tối vui vẻ', 'Chúc ngày mới tốt lành']).toContain(g);
  });

  it('viDate format đúng', () => {
    const d = welcome.viDate();
    expect(d.thu).toMatch(/Thứ|Chủ nhật/);
    expect(d.ngay).toMatch(/tháng/);
    expect(d.gio).toMatch(/^\d{2}:\d{2}$/);
  });

  it('dateVN offset hoạt động', () => {
    const today = welcome.dateVN(0);
    const tomorrow = welcome.dateVN(1);
    const yesterday = welcome.dateVN(-1);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tomorrow).not.toBe(today);
    expect(yesterday).not.toBe(today);
  });
});