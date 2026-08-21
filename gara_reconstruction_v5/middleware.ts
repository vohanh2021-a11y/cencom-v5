/**
 * Next.js Middleware — Security Hardening
 *
 * ★ QUYẾT ĐỊNH: Security headers đặt ở next.config.js (qua async headers()).
 *   Middleware CHỈ xử lý rate-limit cho /api/auth.
 *   Lý do: headers qua next.config là canonical, hoạt động ở mọi runtime,
 *   không cần import thêm trong Edge Runtime, dễ maintain hơn.
 *
 * ★ Rate-limit: Áp dụng cho TẤT CẢ POST requests tới /api/auth.
 *   Middleware KHÔNG thể đọc POST body (sẽ consume stream),
 *   nên rate-limit toàn bộ POST thay vì chỉ action=login.
 *   Điều này accept được vì: logout/changePassword không cần brute-force,
 *   và người dùng bình thường không POST 5 lần trong 5 phút.
 *
 * Edge Runtime — KHÔNG import Node.js APIs (crypto, fs, pg...).
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from './lib/rateLimit';

// ─── Rate-limit config cho login ───────────────────────────────────
// 5 lần thử / 5 phút / IP — chống brute-force
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 phút

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Rate-limit cho POST /api/auth ──────────────────────────────
  if (pathname === '/api/auth' && req.method === 'POST') {
    // Lấy IP: ưu tiên x-forwarded-for (khi qua reverse proxy / load balancer)
    // fallback x-real-ip, rồi req.ip (Next.js tự nhận khi chạy trực tiếp),
    // cuối cùng dùng 'unknown' (mọi client không định danh được chia sẻ bucket —
    // chấp nhận được trên intranet, nhưng khiến rate-limit chặt hơn, KHÔNG lỏng hơn)
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = (forwarded?.split(',')[0]?.trim())
      || req.headers.get('x-real-ip')
      || req.ip
      || 'unknown';

    const { allowed, retryAfterMs } = rateLimit(ip, LOGIN_LIMIT, LOGIN_WINDOW_MS);

    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return new NextResponse(
        JSON.stringify({
          ok: false,
          error: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${retryAfterSec} giây.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': String(retryAfterSec),
            // Không cache response 429
            'Cache-Control': 'no-store',
          },
        }
      );
    }
  }

  // Mọi request khác → cho qua (headers đã set ở next.config.js)
  return NextResponse.next();
}

/**
 * Matcher: middleware CHỈ chạy trên /api/auth.
 * Các path khác không cần rate-limit ở middleware level.
 */
export const config = {
  matcher: '/api/auth',
};
