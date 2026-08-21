/**
 * In-memory rate limiter — Fixed Window algorithm.
 * Edge-compatible (no Node.js-only APIs): dùng được trong Next.js middleware (Edge Runtime).
 *
 * KHÔNG thêm setInterval trong file này vì middleware chạy trên Edge Runtime
 * (Web Worker) — timers có thể không persistent giữa các request trên serverless.
 * Thay vào đó, dùng lazy cleanup: mỗi lần gọi rateLimit(), nếu store vượt ngưỡng
 * thì quét và xóa các window đã hết hạn.
 *
 * Usage:
 *   import { rateLimit } from './lib/rateLimit';
 *   const { allowed, retryAfterMs } = rateLimit(ip, 5, 5 * 60 * 1000);
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

/**
 * Khi store vượt ngưỡng này, thực hiện lazy cleanup
 * để tránh memory leak (xóa các window đã hết hạn).
 * Chọn 1000 vì mỗi entry ~50-100 bytes → 1000 entries ≈ 50-100KB, an toàn.
 */
const CLEANUP_THRESHOLD = 1000;

/**
 * Kiểm tra rate limit cho một key nhất định (VD: IP address).
 *
 * @param key       - Định danh duy nhất (VD: IP, user-agent combo)
 * @param limit     - Số request tối đa cho phép trong 1 window
 * @param windowMs  - Thời lượng window (ms)
 * @returns         { allowed: boolean, retryAfterMs: number }
 *                  retryAfterMs = 0 nếu allowed, hoặc số ms còn lại phải chờ
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

  // Lazy cleanup: quét store khi quá lớn
  if (store.size > CLEANUP_THRESHOLD) {
    for (const [k, v] of store) {
      if (now - v.windowStart > windowMs) {
        store.delete(k);
      }
    }
  }

  const entry = store.get(key);

  // Nếu chưa có entry hoặc window cũ đã hết hạn → tạo window mới
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Window còn hiệu lực — kiểm tra số lượng request
  if (entry.count >= limit) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Xóa toàn bộ store (dùng cho test / reset).
 * @internal
 */
export function _resetStore(): void {
  store.clear();
}
