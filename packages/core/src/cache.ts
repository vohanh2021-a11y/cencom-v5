/**
 * cache.ts — Cache trong bộ nhớ (in-memory TTL) cho kết quả read-only.
 * Port từ server/cache.js v3.6 (giữ NGUYÊN hành vi).
 * Mục đích (Phase 5): giảm số truy vấn DB khi nhiều user đồng thời mở
 * dashboard/list giống nhau. KHÔNG dùng cho dữ liệu nhạy cảm theo user
 * (key phải chứa role nếu cần). TTL ngắn (mặc định 15s) → chấp nhận trễ lạc nhẹ.
 */
'use strict';

const map = new Map<string, { v: unknown; t: number; exp: number; refreshing: boolean }>();
export const DEFAULT_TTL = 15000;

function now(): number {
  return Date.now();
}

export function get(k: string): unknown {
  const e = map.get(k);
  if (!e) return undefined;
  if (now() > e.exp) {
    map.delete(k);
    return undefined;
  }
  return e.v;
}

export function set(k: string, v: unknown, ttl?: number): void {
  map.set(k, { v, t: now(), exp: now() + (ttl || DEFAULT_TTL), refreshing: false });
}

export function del(k: string): void {
  map.delete(k);
}

/**
 * cached(k, ttl, fn): trả giá trị cache hoặc tính mới (hỗ trợ fn async — v4).
 * - Còn hạn → trả ngay (Promise resolved).
 * - Hết hạn nhưng có bản cũ → trả bản cũ NGAY (không block request),
 *   refresh nền (setImmediate) để không tắc event loop dưới đồng nhưng cao.
 * - Lần đầu (sau clearAll): tính 1 lần (bất khả tránh block 1 request).
 * - KHÔNG cache khi fn ném lỗi (giữ bản cũ, thử lại sau).
 */
export async function cached<T>(k: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const e = map.get(k);
  if (e) {
    if (t - e.t < ttl) return e.v as T;
    if (!e.refreshing) {
      e.refreshing = true;
      setImmediate(() => {
        fn()
          .then((v) => {
            if (v != null) {
              e.v = v;
              e.t = Date.now();
            }
          })
          .catch(() => {
            // giữ nguyên e.v (stale) và e.t cũ để thử lại sau
          })
          .finally(() => {
            e.refreshing = false;
          });
      });
    }
    return e.v as T;
  }
  const v = await fn();
  map.set(k, { v, t, exp: t + ttl, refreshing: false });
  return v;
}

export function clearPrefix(pre: string): void {
  if (!pre) {
    map.clear();
    return;
  }
  for (const k of [...map.keys()]) {
    if (k.startsWith(pre)) map.delete(k);
  }
}

export function clearAll(): void {
  map.clear();
}

export default { get, set, del, cached, clearPrefix, clearAll, DEFAULT_TTL };