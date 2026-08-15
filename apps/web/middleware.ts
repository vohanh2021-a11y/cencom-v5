/**
 * middleware.ts — Next.js Middleware (Edge runtime).
 *
 * Chạy TRƯỚC mọi request. Nhiệm vụ:
 * 1. Đọc cookie `cen_session` từ request.
 * 2. Nếu có token → thêm header `x-session-token` để route handler xử lý.
 * 3. Nếu KHÔNG có token và request tới protected route → redirect /login.
 *
 * Lưu ý: Middleware chạy trên Edge runtime — KHÔNG dùng được Node.js APIs
 * (AsyncLocalStorage, fs, crypto). Việc resolve user từ DB thực hiện ở
 * route handler (Node.js runtime).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Các path KHÔNG cần auth */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/health',
  '/_next',
  '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bỏ qua public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Đọc session token từ cookie
  const token = request.cookies.get('cen_session')?.value;

  if (!token) {
    // Chưa đăng nhập → redirect về /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Có token → thêm header để route handler resolve user
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-session-token', token);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match tất cả paths ngoại trừ:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
