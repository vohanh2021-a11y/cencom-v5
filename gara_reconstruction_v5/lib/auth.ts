import crypto from 'crypto';
import type { Actor, Db } from './types';
import { row } from './db';

export const SESSION_COOKIE = 'sid';

/**
 * Thời hạn sống của session token (ms) — khớp cookie maxAge 7 ngày ở /api/auth.
 * Token hết hạn (exp claim) sẽ bị verifySession từ chối ngay cả khi chữ ký HMAC hợp lệ.
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const norm = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(norm, 'base64');
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return 'scrypt:' + salt.toString('hex') + ':' + hash.toString('hex');
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(pw, salt, 64);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function signSession(actor: Actor): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const payload = b64url(
    JSON.stringify({ ...actor, exp: Date.now() + SESSION_TTL_MS })
  );
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return payload + '.' + sig;
}

export function verifySession(token?: string): Actor | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload).toString('utf8')) as Actor & { exp?: unknown };
    if (
      !data ||
      typeof data.id !== 'string' ||
      typeof data.name !== 'string' ||
      typeof data.role !== 'string'
    ) {
      return null;
    }
    // Session expiry: token thiếu exp (legacy) hoặc đã hết hạn → từ chối.
    if (typeof data.exp !== 'number' || !Number.isFinite(data.exp) || data.exp < Date.now()) {
      return null;
    }
    return { id: data.id, name: data.name, role: data.role };
  } catch {
    return null;
  }
}

/**
 * CSRF defense-in-depth (bổ sung cho cookie SameSite=Lax):
 * Browser luôn gửi header `Origin` trên POST cross-origin/cross-site.
 * Nếu Origin tồn tại và host của nó khác Host của server → chặn (403).
 * Non-browser clients (supertest, curl, health-check) không gửi Origin → được qua.
 */
export function isSameOrigin(req: {
  headers: { get(name: string): string | null };
}): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // không phải browser request → không có CSRF risk
  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get('host');
    if (!host) return false;
    return originHost === host;
  } catch {
    return false; // Origin malformed → chặn
  }
}

export async function login(db: Db, user: string, pass: string): Promise<Actor | null> {
  const u = await row<any>('SELECT * FROM users WHERE name=$1 AND deleted_at=$2', [user, '']);
  if (!u) return null;
  if (!verifyPassword(pass, u.pass_hash)) return null;
  return { id: u.id, name: u.name, role: u.role };
}

export function getCurrentActor(token?: string): Actor | null {
  return verifySession(token);
}
