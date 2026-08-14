/**
 * auth.ts — Xác thực + phiên GĐ2–đợt 2 (port từ server/auth.js v3.6).
 * Thay đổi so với v3.6:
 *  - `sessions.expires_at` trong PG là TIMESTAMPTZ (migrator đã đổi epoch→timestamptz)
 *    → dùng `now() + interval` thay cho epoch millis.
 *  - Mọi hàm async (pg pool).
 * Giữ NGUYÊN: scrypt "scrypt:salt:hash", cookie HttpOnly SameSite=Strict,
 * rate-limit login/đổi mật khẩu (in-memory), `current()` actor context.
 */
import crypto from 'node:crypto';
import type { Db } from './db.js';

const TOKEN_BYTES = 24;
export const SESSION_DAYS = 14;
export const DEFAULT_PASSWORD = 'cencom@123';

/* ---------------- Chống dò mật khẩu (brute force) ----------------
 * PHÁT TRIỂN: mặc định TẮT chặn login sai (chỉ ghi WARN). Production bật LOGIN_RATE_LIMIT=1. */
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const _failMap = new Map<string, { n: number; t0: number }>();
export function loginRateLimitEnabled(): boolean {
  return process.env.LOGIN_RATE_LIMIT === '1';
}
export function loginBlocked(ip: string): boolean {
  const now = Date.now();
  const rec = _failMap.get(ip);
  if (!rec) return false;
  if (now - rec.t0 > LOGIN_WINDOW_MS) {
    _failMap.delete(ip);
    return false;
  }
  return rec.n >= LOGIN_MAX_FAILS;
}
export function loginFail(ip: string): void {
  const now = Date.now();
  const rec = _failMap.get(ip) || { n: 0, t0: now };
  if (now - rec.t0 > LOGIN_WINDOW_MS) {
    rec.n = 0;
    rec.t0 = now;
  }
  rec.n += 1;
  _failMap.set(ip, rec);
}
export function loginReset(ip: string): void {
  _failMap.delete(ip);
}

/* ---------------- Rate-limit đổi mật khẩu (chống dò mật khẩu cũ) ---------------- */
const CP_MAX_FAILS = 5;
const CP_WINDOW_MS = 15 * 60 * 1000;
const _cpFailMap = new Map<string, { n: number; t0: number }>();
export function cpBlocked(userId: string): boolean {
  const now = Date.now();
  const rec = _cpFailMap.get(userId);
  if (!rec) return false;
  if (now - rec.t0 > CP_WINDOW_MS) {
    _cpFailMap.delete(userId);
    return false;
  }
  return rec.n >= CP_MAX_FAILS;
}
export function cpFail(userId: string): void {
  const now = Date.now();
  const rec = _cpFailMap.get(userId) || { n: 0, t0: now };
  if (now - rec.t0 > CP_WINDOW_MS) {
    rec.n = 0;
    rec.t0 = now;
  }
  rec.n += 1;
  _cpFailMap.set(userId, rec);
}
export function cpReset(userId: string): void {
  _cpFailMap.delete(userId);
}

/* Cờ Secure cookie: bật qua env khi chạy https (không bật mặc định vì dev/test dùng http). */
export const secureCookie = process.env.SECURE_COOKIE === '1';

/* ---------------- Mật khẩu ---------------- */
export function hashPassword(pw: string, salt?: string): string {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pw), s, 64).toString('hex');
  return 'scrypt:' + s + ':' + h;
}
export function verifyPassword(stored: string, pw: string): boolean {
  if (!stored || !pw) return false;
  const parts = String(stored).split(':');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const [, salt, hashHex] = parts as [string, string, string];
  const a = Buffer.from(hashHex, 'hex');
  const b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- Phiên ---------------- */
function newToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export async function createSession(db: Db, userId: string): Promise<string> {
  await db.run('DELETE FROM sessions WHERE expires_at < now()');
  const token = newToken();
  await db.run(
    "INSERT INTO sessions(token, user_id, expires_at) VALUES($1,$2, now() + ($3 || ' days')::interval)",
    token,
    userId,
    SESSION_DAYS
  );
  return token;
}
export async function touchSession(db: Db, token: string): Promise<void> {
  await db.run(
    "UPDATE sessions SET expires_at = now() + ($1 || ' days')::interval WHERE token = $2",
    SESSION_DAYS,
    token
  );
}
export async function sessionUser(
  db: Db,
  token: string
): Promise<{ id: string; name: string; role: string; phone: string; phong_ban: string; must_change: number } | null> {
  if (!token) return null;
  const s = await db.row<{ id: string; name: string; role: string; phone: string; phong_ban: string; must_change: number }>(
    `SELECT u.id, u.name, u.role, u.phone, u.phong_ban, u.must_change
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    token
  );
  if (s) await touchSession(db, token);
  return s || null;
}
export async function destroySession(db: Db, token: string): Promise<void> {
  if (token) await db.run('DELETE FROM sessions WHERE token = $1', token);
}

/* ---------------- Người dùng ---------------- */
export async function findUser(
  db: Db,
  login: string
): Promise<{ id: string; name: string; role: string; phone: string; pass_hash: string; must_change: number; active: number } | null> {
  if (!login) return null;
  const u = await db.row<{ id: string; name: string; role: string; phone: string; pass_hash: string; must_change: number; active: number }>(
    'SELECT * FROM users WHERE active = 1 AND (upper(id) = upper($1) OR upper(name) = upper($2))',
    login,
    login
  );
  return u || null;
}
export async function authenticatePassword(
  db: Db,
  login: string,
  pw: string
): Promise<{ id: string; name: string; role: string; phone: string; phong_ban: string; must_change: boolean } | null> {
  const u = await findUser(db, login);
  if (!u || !verifyPassword(u.pass_hash, pw)) return null;
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    phone: u.phone,
    phong_ban: (u as { phong_ban?: string }).phong_ban || '',
    must_change: !!u.must_change,
  };
}
export async function setPasswordFor(db: Db, userId: string, plain: string): Promise<void> {
  await db.run('UPDATE users SET pass_hash = $1 WHERE id = $2', hashPassword(plain), userId);
}
export async function setMustChange(db: Db, userId: string, flag: boolean): Promise<void> {
  await db.run('UPDATE users SET must_change = $1 WHERE id = $2', flag ? 1 : 0, userId);
}
export async function mustChange(db: Db, userId: string): Promise<boolean> {
  const r = await db.row<{ must_change: number }>('SELECT must_change FROM users WHERE id = $1', userId);
  return !!(r && r.must_change);
}

/* ---------------- current() — actor context (setUser trước mỗi RPC) ---------------- */
let _actor: { id: string; name: string; role: string; phone?: string; phong_ban?: string } | null = null;
export function setUser(u: { id: string; name: string; role: string; phone?: string; phong_ban?: string } | null): void {
  _actor = u || null;
}
export function current(): { id: string; name: string; role: string; phone?: string; phong_ban?: string } | null {
  return _actor;
}
export function currentName(): string {
  return (_actor && _actor.name) || '';
}

export default {
  DEFAULT_PASSWORD,
  SESSION_DAYS,
  secureCookie,
  loginBlocked,
  loginFail,
  loginReset,
  loginRateLimitEnabled,
  cpBlocked,
  cpFail,
  cpReset,
  hashPassword,
  verifyPassword,
  createSession,
  sessionUser,
  destroySession,
  findUser,
  authenticatePassword,
  setPasswordFor,
  setMustChange,
  mustChange,
  setUser,
  current,
  currentName,
};