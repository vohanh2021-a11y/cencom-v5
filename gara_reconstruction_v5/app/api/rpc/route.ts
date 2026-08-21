import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { getCurrentActor, isSameOrigin, SESSION_COOKIE } from '../../../lib/auth';
import { can } from '../../../lib/perm';
import { dispatch } from '../../../lib/rpc';
import { createLogger } from '../../../lib/logger';
import { inc } from '../../../lib/metrics';

const logger = createLogger('rpc');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // CSRF defense-in-depth: chặn POST cross-site có header Origin không khớp host
  if (!isSameOrigin(req)) {
    inc('http_requests_total', { method: 'POST', path: '/api/rpc', status: '403' });
    logger.warn('RPC blocked: cross-origin request', { origin: req.headers.get('origin') });
    return NextResponse.json({ ok: false, error: 'Origin không hợp lệ' }, { status: 403 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 }); }
  const fn = body?.fn;
  const args = body?.args ?? {};
  if (typeof fn !== 'string' || fn.length === 0) {
    return NextResponse.json({ ok: false, error: 'Thiếu fn' }, { status: 400 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const actor = getCurrentActor(token);
  const api = { db, auth: { current: () => actor }, perm: { can: (d: any, r: string, m: string, f: string) => can(d, r, m, f) } };
  try {
    const result = await dispatch(api, fn, args);
    inc('http_requests_total', { method: 'POST', path: '/api/rpc', status: '200' });
    logger.info('RPC OK', { fn, userId: actor?.id });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    const msg = e?.message || 'Error';
    inc('rpc_errors_total', { fn, error: msg });
    inc('http_requests_total', { method: 'POST', path: '/api/rpc', status: String(e?.message === '401' ? 401 : e?.message === '403' ? 403 : 400) });
    // 401/403/Unknown fn = lỗi nghiệp vụ dự kiến → WARN; còn lại là lỗi hệ thống (DB, bug...) → ERROR + stack
    if (msg === '401' || msg === '403' || msg.startsWith('Unknown fn')) {
      logger.warn('RPC error', { fn, error: msg, userId: actor?.id });
    } else {
      logger.error('RPC handler failed', { fn, error: msg, stack: e?.stack, userId: actor?.id });
    }
    if (msg === '401') return NextResponse.json({ ok: false, error: 'Chưa đăng nhập' }, { status: 401 });
    if (msg === '403') return NextResponse.json({ ok: false, error: 'Không đủ quyền' }, { status: 403 });
    if (msg.startsWith('Unknown fn')) return NextResponse.json({ ok: false, error: msg }, { status: 404 });
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'RPC endpoint — use POST {fn,args}' });
}