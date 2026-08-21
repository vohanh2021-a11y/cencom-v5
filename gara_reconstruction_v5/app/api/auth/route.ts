import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db as pool } from '../../../lib/db';
import { login, getCurrentActor, signSession, isSameOrigin, SESSION_COOKIE } from '../../../lib/auth';
import { createLogger } from '../../../lib/logger';
import { inc } from '../../../lib/metrics';

const logger = createLogger('auth');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // CSRF defense-in-depth: chặn POST cross-site có header Origin không khớp host
  if (!isSameOrigin(req)) {
    inc('login_fail_total', { reason: 'cross_origin' });
    logger.warn('Auth blocked: cross-origin request', { origin: req.headers.get('origin') });
    return NextResponse.json({ ok: false, error: 'Origin không hợp lệ' }, { status: 403 });
  }
  const { action, user, pass, newPass } = await req.json().catch(() => ({}));
  if (action === 'login') {
    const actor = await login(pool, user || '', pass || '');
    if (!actor) {
      inc('login_fail_total', { reason: 'bad_credentials' });
      logger.warn('Login failed', { user: user || '(empty)' });
      return NextResponse.json({ ok: false, error: 'Sai tài khoản/mật khẩu' }, { status: 401 });
    }
    logger.info('Login successful', { userId: actor.id, role: actor.role });
    const token = signSession(actor);
    const r = NextResponse.json({ ok: true, user: actor });
    r.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return r;
  }
  if (action === 'logout') {
    const r = NextResponse.json({ ok: true });
    r.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return r;
  }
  if (action === 'changePassword') {
    return NextResponse.json({ ok: false, error: 'chưa hỗ trợ' }, { status: 501 });
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('info') === '1') {
    return NextResponse.json({
      ok: true,
      appInfo: { app: 'cencomOS v5.0', roles: ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] },
    });
  }
  const token = cookies().get(SESSION_COOKIE)?.value;
  const actor = getCurrentActor(token);
  return NextResponse.json({ ok: true, user: actor });
}
