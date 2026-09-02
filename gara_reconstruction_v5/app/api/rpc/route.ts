import { NextRequest, NextResponse } from 'next/server';
import { getCurrentActor, getMustChange, isSameOrigin, SESSION_COOKIE } from '../../../lib/auth';
import { dispatch } from '../../../lib/rpc';
import { buildApi } from '../../../lib/api';
import { createLogger } from '../../../lib/logger';
import { inc } from '../../../lib/metrics';

const logger = createLogger('rpc');

export const dynamic = 'force-dynamic';

/**
 * W4.1 — whitelist fn được phép khi tài khoản đang must_change=1.
 * Port v3.6 index.js:155 (changePassword/currentUser/appInfo) + 'logout'
 * theo hợp đồng task W4.1 (khóa người dùng mà không cho thoát thìsession
 * treo còn tệ hơn). changePassword CHƯA reg vào lib/rpc.ts (đợt reg gộp
 * sau — fn đã sẵn trong lib/auth.ts); tên giữ nguyên để whitelist đúng
 * NGAY khi reg thêm HANDLERS. (KHÔNG export — next route type validator
 * chỉ cho export handler/config; test đối chiếu hành vi qua HTTP, không import.)
 */
const MUST_CHANGE_WHITELIST: ReadonlySet<string> = new Set([
  'changePassword', 'currentUser', 'appInfo', 'logout',
]);

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
  /* ---------- W4.1 (GĐ3.6.2) — BUỘC ĐỔI MẬT KHẨU: đọc cờ must_change SỐNG
     từ DB theo actor.id mỗi request (đọc đúng data nguồn như v3.6 JOIN
     sessions×users auth.js:92–100 — cờ đổi giữa phiên có hiệu lực tức thì;
     KHÔNG nhét vào session HMAC vì token 7 ngày sẽ giữ cờ cũ).
     Chặn TRƯỚC dispatch cho MỌI fn ngoài whitelist bằng envelope 403
     (v3.6:156 giữ 200+needChangePw; task W4.1 chốt 403 rõ ràng hơn cho
     client mới — flag needChangePw vẫn kèm để UI chuyển hướng đổi mk). ---------- */
  if (actor && !MUST_CHANGE_WHITELIST.has(fn)) {
    let mustChange = false;
    try {
      mustChange = await getMustChange(actor.id);
    } catch (e: any) {
      // Fail-closed: không đọc được trạng thái tài khoản → KHÔNG cho qua fn nhạy cảm
      logger.error('must_change check failed (fail-closed)', { fn, userId: actor.id, error: e?.message });
      inc('http_requests_total', { method: 'POST', path: '/api/rpc', status: '403' });
      return NextResponse.json({ ok: false, error: 'Không xác minh được trạng thái tài khoản. Thử lại sau.' }, { status: 403 });
    }
    if (mustChange) {
      inc('http_requests_total', { method: 'POST', path: '/api/rpc', status: '403' });
      logger.warn('RPC blocked: must_change', { fn, userId: actor.id });
      return NextResponse.json(
        { ok: false, error: 'Bạn đang dùng mật khẩu mặc định. Hãy đổi mật khẩu trước khi tiếp tục.', needChangePw: true },
        { status: 403 }
      );
    }
  }
  const api = buildApi(actor);
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