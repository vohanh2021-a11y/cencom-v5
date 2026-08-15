/**
 * POST /api/auth — Login endpoint.
 * DELETE /api/auth — Logout endpoint.
 *
 * Contract:
 * - POST { username, password } → { ok, user?, error? } + Set-Cookie
 * - DELETE → { ok } + Clear-Cookie
 */
import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrf';
import { Pool } from 'pg';
import * as core from '@cencom/core';

/* ─── Lazy-init PG pool ─── */
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return _pool;
}

/* ─── POST /api/auth — Login ─── */
export async function POST(request: Request) {
  // CSRF guard
  const csrfError = csrfGuard(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Thiếu username hoặc password' },
        { status: 400 },
      );
    }

    // Rate limit check
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (core.auth.loginBlocked(ip)) {
      return NextResponse.json(
        { ok: false, error: 'Quá nhiều lần thử sai. Thử lại sau.' },
        { status: 429 },
      );
    }

    const pool = getPool();
    const db = core.createDb(core.makePgExecutor(pool));

    // Authenticate
    const user = await core.auth.authenticatePassword(db, username, password);

    if (!user) {
      core.auth.loginFail(ip);
      console.warn(`[AUTH] Login failed: username=${username}, ip=${ip}`);
      return NextResponse.json(
        { ok: false, error: 'Sai tài khoản hoặc mật khẩu' },
        { status: 401 },
      );
    }

    // Reset fail counter
    core.auth.loginReset(ip);

    // Create session
    const token = await core.auth.createSession(db, user.id);

    console.log(`[AUTH] Login success: ${user.name} (${user.role}), ip=${ip}`);

    // Set cookie
    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        mustChange: user.must_change,
      },
    });

    const isSecure = process.env['SECURE_COOKIE'] === '1';
    response.cookies.set('cen_session', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 14 * 24 * 60 * 60, // 14 ngày
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return NextResponse.json(
      { ok: false, error: 'Lỗi server nội bộ' },
      { status: 500 },
    );
  }
}

/* ─── DELETE /api/auth — Logout ─── */
export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('x-session-token') ||
                  request.headers.get('cookie')?.match(/cen_session=([^;]+)/)?.[1];

    if (token) {
      const pool = getPool();
      const db = core.createDb(core.makePgExecutor(pool));
      await core.auth.destroySession(db, token);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete('cen_session');
    return response;
  } catch (err) {
    console.error('[AUTH] Logout error:', err);
    return NextResponse.json({ ok: true }); // Vẫn logout thành công dù có lỗi
  }
}
