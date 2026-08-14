/**
 * auth.test.ts — Conformance auth (port auth.js → auth.ts):
 * scrypt hash/verify, authenticatePassword, session tạo/đọc/xoá, must_change,
 * đổi mật khẩu.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  sessionUser,
  destroySession,
  authenticatePassword,
  setPasswordFor,
  setMustChange,
  mustChange,
  DEFAULT_PASSWORD,
} from '../src/auth.js';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
}, 60000);

afterEach(() => {
  ctx.setActor(null);
});

describe('auth.scrypt', () => {
  it('hashPassword tạo chuỗi scrypt:salt:hash + verify đúng/sai', () => {
    const h = hashPassword('mat-khau-1');
    expect(h.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword(h, 'mat-khau-1')).toBe(true);
    expect(verifyPassword(h, 'mat-khau-sai')).toBe(false);
  });

  it('verifyPassword với salt cố định deterministic', () => {
    const h = hashPassword('cencom@123', 'aabbccddeeff00112233445566778899');
    expect(verifyPassword(h, 'cencom@123')).toBe(true);
  });

  it('từ chối định dạng lạ', () => {
    expect(verifyPassword('plaintext', 'x')).toBe(false);
    expect(verifyPassword('', 'x')).toBe(false);
  });
});

describe('auth.session', () => {
  it('createSession → sessionUser trả user + touch; destroySession xoá', async () => {
    const token = await createSession(ctx.db, 'admin-1');
    const u = await sessionUser(ctx.db, token);
    expect(u).not.toBeNull();
    expect(u!.id).toBe('admin-1');
    expect(u!.role).toBe('admin');
    await destroySession(ctx.db, token);
    expect(await sessionUser(ctx.db, token)).toBeNull();
  });

  it('sessionUser với token lạ → null', async () => {
    expect(await sessionUser(ctx.db, 'khong-ton-tai')).toBeNull();
  });
});

describe('auth.authenticatePassword', () => {
  it('đăng nhập đúng mật khẩu mặc định trả user + must_change=1', async () => {
    const u = await authenticatePassword(ctx.db, 'admin-1', DEFAULT_PASSWORD);
    expect(u).not.toBeNull();
    expect(u!.must_change).toBe(true);
  });

  it('đăng nhập bằng tên (không phân biệt hoa thường)', async () => {
    const u = await authenticatePassword(ctx.db, 'ADMIN-1', DEFAULT_PASSWORD);
    expect(u).not.toBeNull();
  });

  it('sai mật khẩu → null', async () => {
    expect(await authenticatePassword(ctx.db, 'admin-1', 'sai')).toBeNull();
  });
});

describe('auth.must_change + setPasswordFor', () => {
  it('setMustChange + mustChange + đổi mật khẩu', async () => {
    await setPasswordFor(ctx.db, 'admin-1', 'mat-khau-moi-123');
    await setMustChange(ctx.db, 'admin-1', false);
    expect(await mustChange(ctx.db, 'admin-1')).toBe(false);
    // mật khẩu cũ không còn đúng
    expect(await authenticatePassword(ctx.db, 'admin-1', DEFAULT_PASSWORD)).toBeNull();
    expect(await authenticatePassword(ctx.db, 'admin-1', 'mat-khau-moi-123')).not.toBeNull();
  });
});