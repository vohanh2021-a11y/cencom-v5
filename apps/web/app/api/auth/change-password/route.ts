/**
 * POST /api/auth/change-password — Đổi mật khẩu (bắt buộc lần đầu / tự đổi).
 * Contract: POST { oldPassword, newPassword } -> { ok, error? }
 * Yêu cầu: đã đăng nhập (cookie cen_session).
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { csrfGuard } from '@/lib/csrf';
import * as core from '@cencom/core';

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

export async function POST(request: Request) {
  // CSRF guard (Origin/Referer same-origin)
  const csrfError = csrfGuard(request);
  if (csrfError) return csrfError;

  try {
    const token =
      request.headers.get('x-session-token') ||
      request.headers.get('cookie')?.match(/cen_session=([^;]+)/)?.[1];

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const pool = getPool();
    const db = core.createDb(core.makePgExecutor(pool));
    const user = await core.auth.sessionUser(db, token);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Phiên hết hạn, đăng nhập lại.' }, { status: 401 });
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body as { oldPassword?: string; newPassword?: string };

    const res = await core.auth.changePassword(db, user.id, oldPassword || '', newPassword || '');
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }

    console.log(`[AUTH] Password changed: ${user.name} (${user.role})`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] Change password error:', err);
    return NextResponse.json({ ok: false, error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}
