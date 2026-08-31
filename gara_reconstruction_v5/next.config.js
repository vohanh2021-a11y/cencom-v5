/**
 * Next.js Configuration — CencomOS Gara v5.0
 *
 * ★ QUYẾT ĐỊNH: Security headers đặt ở đây (qua async headers()).
 *   Middleware CHỈ xử lý rate-limit cho /api/auth POST.
 *   Lý do: tránh trùng lặp, canonical Next.js pattern,
 *   hoạt động ở mọi runtime (server, edge, middleware).
 *
 * ★ CSP Notes:
 *   - 'unsafe-inline' cho style-src: BẮT BUỘC cho Tailwind CSS
 *     (inject inline styles + className-based styling)
 *   - 'unsafe-inline' + 'unsafe-eval' cho script-src: Next.js App Router
 *     cần inline scripts (hydration) và eval cho HMR in dev.
 *     production nên dùng nonce nếu cần hardened hơn.
 *   - frame-ancestors 'none': tương đương X-Frame-Options: DENY
 *     + chống clickjacking trên mọi browser hiện đại.
 *
 * ★ HSTS: KHÔNG thêm ở đây vì app có thể chạy HTTP trong dev/on-premise.
 *   Khi deploy production HTTPS, thêm header HSTS qua reverse proxy (Nginx)
 *   hoặc conditional check env.
 */

const securityHeaders = [
  // ─── Anti-MIME-sniffing ──────────────────────────────────────
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // ─── Anti-clickjacking ───────────────────────────────────────
  { key: 'X-Frame-Options', value: 'DENY' },

  // ─── Referrer policy ─────────────────────────────────────────
  // strict-origin-when-cross-origin: gửi full URL khi same-origin,
  // chỉ gửi origin khi cross-origin (HTTPS→HTTPS), không gửi gì HTTP→HTTPS
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // ─── Permissions policy ──────────────────────────────────────
  // Tắt các tính năng không cần thiết: camera, microphone, geolocation,
  // payment, usb, screen-wake-lock. Garage management app không cần这些.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()',
  },

  // ─── Content Security Policy ─────────────────────────────────
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  output: 'standalone',

  // ★ Mitigation CVE Next.js Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f, GHSA-h64f-5h5j-jqjh, GHSA-3x4c-7xq6-9pq8)
  // Tắt Image Optimization API trên self-hosted để loại bỏ vecto tấn công DoS qua remotePatterns / disk cache.
  images: {
    unoptimized: true,
  },

  experimental: {
    instrumentationHook: true,
  },

  async headers() {
    return [
      {
        // Áp dụng cho TẤT CẢ routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
