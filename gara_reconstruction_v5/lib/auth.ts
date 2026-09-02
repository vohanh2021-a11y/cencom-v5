import crypto from 'crypto';
import type { Actor, Api, Db } from './types';
import { row, run } from './db';
import { logActivity } from './core/activity';
import { createScopedLogger } from './observability';

export const SESSION_COOKIE = 'sid';

const log = createScopedLogger('auth');

/**
 * Mật khẩu mặc định của tài khoản seed/user mới tạo (port v3.6 auth.js:14).
 * ĐÂU là demo credential công khai theo docs/README v3.6 — không phải secret
 * production; tài khoản dùng mk này bị BẮT BUỘC đổi lần đăng nhập đầu
 * (cột users.must_change, GĐ3.6.2 — enforce tại app/api/rpc/route.ts).
 */
export const DEFAULT_PASSWORD = 'cencom@123';

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

/* ============================================================
 * W4.1 — must_change + đổi mật khẩu tự thân (port v3.6)
 *
 * Nguồn v3.6:
 *  - auth.js:110–120 setPasswordFor / setMustChange / mustChange
 *  - auth.js:39–57   chống dò mật khẩu cũ khi đổi (CP_MAX_FAILS=5/15 phút)
 *  - handlers.js:551–573 changePassword: verify mật khẩu cũ, mới ≥6 ký tự,
 *                    cấm đặt lại đúng mật khẩu mặc định, clear must_change, audit
 *  - index.js:155    whitelist RPC khi đang must_change: changePassword /
 *                    currentUser / appInfo (v5 thêm 'logout' theo task W4.1)
 *
 * Enforce nằm ở app/api/rpc/route.ts — ĐỌC SỐNG DB theo actor.id mỗi request
 * (không tin cờ trong session HMAC: admin đặt/xóa cờ phải có hiệu lực ngay,
 * port đúng bản chất v3.6 JOIN sessions×users theo token từng request).
 * ============================================================ */

/**
 * Đọc cột users.must_change sống từ DB (port auth.js mustChange:117–120).
 * User không tồn tại / sự cố đọc → trả false? KHÔNG — user không tồn tại
 * tức tài khoản đã bay: coi như không chặn được nữa (v3.6: !!r && r.must_change
 * = false khi lack row) → false, dispatch phía sau tự 401/500 vì FK mất.
 * LỖI DB NÉM THẲNG để route fail-closed (không lặng lẽ mở cổng).
 */
export async function getMustChange(userId: string): Promise<boolean> {
  const r = await row<{ must_change: number | null }>(
    'SELECT must_change FROM users WHERE id = $1',
    [userId]
  );
  return !!(r && Number(r.must_change));
}

/** Đổi mật khẩu đã lưu cho user (port auth.js setPasswordFor:110–112). */
export async function setPasswordFor(userId: string, plain: string): Promise<void> {
  await run('UPDATE users SET pass_hash = $2 WHERE id = $1', [userId, hashPassword(plain)]);
}

/** Bật/tắt cờ buộc đổi mật khẩu (port auth.js setMustChange:114–116). */
export async function setMustChange(userId: string, flag: boolean): Promise<void> {
  await run('UPDATE users SET must_change = $2 WHERE id = $1', [userId, flag ? 1 : 0]);
}

/* ---- Chống dò mật khẩu cũ khi đổi (port v3.6 auth.js:39–57, in-process) ---- */
const CP_MAX_FAILS = 5;
const CP_WINDOW_MS = 15 * 60 * 1000; // 15 phút
const _cpFailMap = new Map<string, { n: number; t0: number }>();

function cpBlocked(userId: string): boolean {
  const now = Date.now();
  const rec = _cpFailMap.get(userId);
  if (!rec) return false;
  if (now - rec.t0 > CP_WINDOW_MS) { _cpFailMap.delete(userId); return false; }
  return rec.n >= CP_MAX_FAILS;
}
function cpFail(userId: string): void {
  const now = Date.now();
  const rec = _cpFailMap.get(userId) || { n: 0, t0: now };
  if (now - rec.t0 > CP_WINDOW_MS) { rec.n = 0; rec.t0 = now; }
  rec.n += 1;
  _cpFailMap.set(userId, rec);
}
function cpReset(userId: string): void { _cpFailMap.delete(userId); }

/**
 * changePassword — user đang đăng nhập TỰ đổi mật khẩu của mình
 * (port NGUYÊN handlers.js:551–573 + whitelist index.js:155).
 *
 * ĐÂY LÀ LỐI THOÁT DUY NHẤT khỏi trạng thái must_change: route /api/rpc
 * chặn mọi fn khác cho tới khi đổi xong. Verify mật khẩu cũ (khác fn admin
 * userSetPassword — admin KHÔNG cần mật khẩu cũ, port handlers.js:165).
 *
 * Kết quả theo ENVELOPE {ok}/{ok,error} — KHÔNG throw cho lỗi nghiệp vụ
 * (quy ước hàm mới W1b+; fn sẽ được reg vào lib/rpc.ts ở đợt gộp tiếp theo).
 */
export async function changePassword(
  api: Api,
  p: { old_password?: any; new_password?: any } = {}
): Promise<{ ok: boolean; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' }; // v3.6:553
  if (cpBlocked(u.id)) {
    return { ok: false, error: 'Quá nhiều lần thử sai mật khẩu cũ. Thử lại sau 15 phút.' }; // v3.6:555
  }
  const rec = await row<{ pass_hash: string }>(
    'SELECT pass_hash FROM users WHERE id = $1',
    [u.id]
  );
  if (!rec || !verifyPassword(String(p?.old_password ?? ''), rec.pass_hash)) {
    cpFail(u.id); // v3.6:559 — đếm theo tài khoản, không theo ip
    log.logWarn('changePassword: sai mật khẩu cũ', { userId: u.id });
    return { ok: false, error: 'Mật khẩu cũ không đúng.' }; // v3.6:560
  }
  const newPw = String(p?.new_password ?? '');
  if (!newPw || newPw.length < 6) {
    return { ok: false, error: 'Mật khẩu mới phải từ 6 ký tự.' }; // v3.6:563
  }
  if (newPw === DEFAULT_PASSWORD) {
    // v3.6:566 — cấm quay về đúng mk mặc định, nếu không vòng must_change vô nghĩa
    return { ok: false, error: 'Không được đặt lại mật khẩu mặc định. Hãy chọn mật khẩu riêng.' };
  }
  await setPasswordFor(u.id, newPw);
  await setMustChange(u.id, false); // v3.6:569 — MỞ CHẶN must_change
  cpReset(u.id); // v3.6:570
  try {
    await logActivity(api.db, {
      actor_id: u.id, actor_role: u.role, hanh_dong: 'doi_mat_khau',
      doi_tuong: 'user', doi_tuong_id: u.id,
      mo_ta: 'Đổi mật khẩu tài khoản ' + u.id, // logNhatKy v3.6:571 nguyên văn
    });
  } catch (e) {
    log.logError('changePassword: logActivity failed', e, { userId: u.id });
  }
  log.logInfo('changePassword OK', { userId: u.id }); // INFO chuẩn 3 (không kèm pw)
  return { ok: true };
}
