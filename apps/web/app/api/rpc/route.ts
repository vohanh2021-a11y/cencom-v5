/**
 * POST /api/rpc — RPC dispatcher endpoint.
 *
 * Contract: { fn: string, args: unknown[] } → { ok: boolean, result?: unknown, error?: string }
 *
 * Flow:
 * 1. CSRF guard
 * 2. Resolve user từ session token
 * 3. Check must_change password
 * 4. Dispatch qua rpc-dispatch.ts (adminOnly → rpcMeta → Zod validate → call core)
 * 5. Return JSON
 */
import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrf';
import { runWithAuth, type AuthUser } from '@/lib/auth-context';
import { dispatchRpc, type RpcResult } from '@/lib/rpc-dispatch';
import { createDb, makePgExecutor } from '@cencom/core';
import { Pool } from 'pg';

/* ─── Lazy-init PG pool (singleton) ─── */
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

/* ─── Session resolution ─── */
async function resolveUser(token: string): Promise<AuthUser | null> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.role, u.phone, u.phong_ban
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      phone: row.phone,
      phong_ban: row.phong_ban,
    };
  } catch (err) {
    console.error('[RPC] Session resolution error:', err);
    return null;
  }
}

/* ─── must_change check ─── */
const MUST_CHANGE_FNS = ['changePassword', 'currentUser', 'appInfo'];

/* ─── POST handler ─── */
export async function POST(request: Request) {
  // 1. CSRF guard
  const csrfError = csrfGuard(request);
  if (csrfError) return csrfError;

  try {
    // 2. Parse body
    const body = await request.json();
    const { fn, args = [] } = body as { fn?: string; args?: unknown[] };

    if (!fn || typeof fn !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Thiếu hoặc sai định dạng "fn"' },
        { status: 400 },
      );
    }

    if (!Array.isArray(args)) {
      return NextResponse.json(
        { ok: false, error: '"args" phải là array' },
        { status: 400 },
      );
    }

    // 3. Resolve user từ session token
    const token = request.headers.get('x-session-token');
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Chưa đăng nhập' },
        { status: 401 },
      );
    }

    const user = await resolveUser(token);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Session hết hạn hoặc không hợp lệ' },
        { status: 401 },
      );
    }

    // 4. Check must_change password
    if (!MUST_CHANGE_FNS.includes(fn)) {
      const pool = getPool();
      const mustChangeResult = await pool.query(
        'SELECT must_change FROM users WHERE id = $1',
        [user.id],
      );
      const mustChange = mustChangeResult.rows[0]?.must_change;
      if (mustChange === 1 || mustChange === true) {
        return NextResponse.json(
          { ok: false, error: 'Đổi mật khẩu', needChangePw: true },
          { status: 403 },
        );
      }
    }

    // 5. Dispatch trong auth context scope
    const pool = getPool();
    const db = createDb(makePgExecutor(pool));

    const result: RpcResult = await runWithAuth(user, async () => {
      return dispatchRpc(fn, args, user, db);
    });

    // 6. Return
    if (result.ok) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (err) {
    console.error('[RPC] Unhandled error:', err);
    return NextResponse.json(
      { ok: false, error: 'Lỗi server nội bộ' },
      { status: 500 },
    );
  }
}
