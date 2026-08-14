/**
 * chat.test.ts — Test module Chat nội bộ (port server/chat.js v3.6).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as chat from '../src/chat.js';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

describe('chat thread + tin nhắn', () => {
  it('chatPeers loại bỏ cenbot + chính mình', async () => {
    const peers = await chat.chatPeers(ctx);
    expect(peers.some((p) => p.id === 'admin')).toBe(false);
    expect(peers.some((p) => p.id === 'cenbot')).toBe(false);
    expect(peers.length).toBeGreaterThan(0);
  });

  it('chatThreadOpen tạo thread 1-1 (không cho nhắn chính mình)', async () => {
    const bad = await chat.chatThreadOpen(ctx, { to: 'admin' });
    expect(bad.ok).toBe(false);
    const r = await chat.chatThreadOpen(ctx, { to: 'tho-1' });
    expect(r.ok).toBe(true);
    expect(r.thread).toMatch(/^CHT-/);
    const r2 = await chat.chatThreadOpen(ctx, { to: 'tho-1' });
    expect(r2.thread).toBe(r.thread); // tái sử dụng thread
  });

  it('chatSend + chatMessages + unread + markRead', async () => {
    const s = await chat.chatSend(ctx, { to: 'tho-1', body: 'Giao việc kiểm tra xe 37H' });
    expect(s.ok).toBe(true);
    const msgs = await chat.chatMessages(ctx, { thread: s.id });
    expect(msgs.length).toBe(1);
    expect(msgs[0]!.body).toContain('Giao việc');
    expect(msgs[0]!.source).toBe('user');
    // tho-1 chưa đọc → admin không bị tính unread (người nhận là tho-1)
    const c = await chat.chatUnreadCount(ctx);
    // chuyển sang tho-1 để đọc
    ctx.setActor({ id: 'tho-1', name: 'Thợ 1', role: 'tho' });
    const unread = await chat.chatUnreadCount(ctx);
    expect(unread.count).toBeGreaterThan(0);
    const mr = await chat.chatMarkRead(ctx, { thread: s.id });
    expect(mr.ok).toBe(true);
    const after = await chat.chatUnreadCount(ctx);
    expect(after.count).toBe(0);
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });

  it('chatSend job gắn ref_id', async () => {
    const s = await chat.chatSend(ctx, { to: 'tho-1', kind: 'job', ref_id: 'SC-000001', body: '' });
    expect(s.ok).toBe(true);
    const msgs = await chat.chatMessages(ctx, { thread: s.id });
    const job = msgs.find((m) => m.kind === 'job');
    expect(job).toBeTruthy();
    expect(job!.ref_id).toBe('SC-000001');
  });

  it('chatDeleteMsg chỉ xoá tin của mình', async () => {
    const s = await chat.chatSend(ctx, { to: 'tho-1', body: 'Tin test xoá' });
    const msgs = await chat.chatMessages(ctx, { thread: s.id });
    const target = msgs.find((m) => m.body === 'Tin test xoá')!;
    ctx.setActor({ id: 'tho-1', name: 'Thợ 1', role: 'tho' });
    const denied = await chat.chatDeleteMsg(ctx, { id: Number(target.id) });
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('của mình');
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
    const ok = await chat.chatDeleteMsg(ctx, { id: Number(target.id) });
    expect(ok.ok).toBe(true);
  });

  it('chatList trả danh sách thread của tôi', async () => {
    await chat.chatSend(ctx, { to: 'tho-1', body: 'Chào thợ 1' });
    const list = await chat.chatList(ctx);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((t) => t.peer === 'tho-1')).toBe(true);
  });
});

describe('bot lệnh nhanh', () => {
  it('/ton trả lời từ tồn kho thật', async () => {
    // tạo vật tư dưới mức tối thiểu để bot có dữ liệu
    const kho = await import('../src/kho.js');
    await kho.vatTuSave(ctx, { name: 'VT bot test', code: 'VT-BOT1', gia: 1000, ton: 1, ton_min: 10 });
    const s = await chat.chatSend(ctx, { to: 'cenbot', body: '/ton' });
    expect(s.ok).toBe(true);
    const msgs = await chat.chatMessages(ctx, { thread: s.id });
    const reply = msgs.filter((m) => m.source === 'bot').pop();
    expect(reply).toBeTruthy();
    expect(String(reply!.body)).toContain('VT bot test');
  });

  it('/sc trả lời danh sách phiếu', async () => {
    const s = await chat.chatSend(ctx, { to: 'cenbot', body: '/sc' });
    const msgs = await chat.chatMessages(ctx, { thread: s.id });
    const reply = msgs.filter((m) => m.source === 'bot').pop();
    expect(reply).toBeTruthy();
  });

  it('/help trả hướng dẫn', async () => {
    const s = await chat.chatSend(ctx, { to: 'cenbot', body: '/help' });
    const msgs = await chat.chatMessages(ctx, { thread: s.id });
    const reply = msgs.filter((m) => m.source === 'bot').pop();
    expect(String(reply!.body)).toContain('/ton');
  });
});