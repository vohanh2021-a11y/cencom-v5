/**
 * scrypt.ts — Mã hoá mật khẩu (port từ server/auth.js v3.6).
 * Format lưu: `scrypt:salt:hash` — so sánh bằng timingSafeEqual.
 * Dùng cho seed (GĐ1) và packages/core/auth.ts (GĐ2).
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const DEFAULT_PASSWORD = 'cencom@123';

export function hashPassword(pw: string, salt?: string): string {
  const s = salt || randomBytes(16).toString('hex');
  const h = scryptSync(String(pw), s, 64).toString('hex');
  return `scrypt:${s}:${h}`;
}

export function verifyPassword(stored: string, pw: string): boolean {
  if (!stored || !pw) return false;
  const parts = String(stored).split(':');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const salt = parts[1]!;
  const hashHex = parts[2]!;
  const a = Buffer.from(hashHex, 'hex');
  const b = scryptSync(String(pw), salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}