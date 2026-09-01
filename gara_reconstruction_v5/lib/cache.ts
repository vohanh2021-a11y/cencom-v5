/**
 * lib/cache.ts — W3.2: Cache in-memory TTL (bản async) cho kết quả đọc nặng.
 * Port v3.6 `server/cache.js` (58 dòng) — nhưng v5 dùng Postgres pool BẤT ĐỒNG
 * BỘ nên loader là `() => Promise<T>` và cơ chế chống "thác nước" đồng thời là
 * SINGLE-FLIGHT: khi một key đang load, mọi lời gọi tới tái sử dụng đúng
 * Promise đó thay vì xếp hàng gọi loader lặp lại.
 *
 * Ngữ cảnh: dashboard XƯỞNG (dashboardAllCached — key `dash:<role>:<ngày>`,
 * TTL 60s, port v3.6 xuong.js dòng 296–305) và các fn đọc khác wire sau.
 *
 * ⚠️ CHỈ LÀ CACHE TRONG TIẾN TRÌNH (in-process). Nhiều instance
 * (Vercel serverless / PM2 cluster / docker scale) MỖI tiến trình có Map riêng
 * → các instance có thể trả dữ lệch nhau tối đa TTL và clearPrefix chỉ tác động
 * instance đang chạy. Khi cần nhất quán đa instance: chuyển sang Redis
 * (SET key val EX ttl + GETDEL/Lua cho single-flight) — TODO(supabase-redis)
 * khi triển khai scale-out.On-premise docker-compose một web container thì
 * in-process là đủ (một EventLoop).
 *
 * QUY ƯỚC AN TOÀN (theo task + v3.6 dòng 4–7):
 *  - Kết quả cache phải KHÔNG nhạy-cảm-theo-cá-nhân ngoài phạm vi đã nằm trong
 *    KEY: mọi key phải chứa role/user-phạm-vi nếu dữ liệu phân quyền
 *    (vd `dash:${role}`). KHÔNG cache phiên đăng nhập / token / PII theo user.
 *  - Loader NÉM LỖI → KHÔNG cache (xóa trạng thái đang load) để lần gọi sau
 *    thử lại; lỗi gốc được tung lên cho caller (không che).
 *  - Envelope {ok:false,...} là giá trị resolve BÌNH THƯỜNG → được cache
 *    (dashboardAll cố ý không throw cho 401/403). Caller chịu trách nhiệm về
 *    tính vô hại: chỉ cache envelope "rỗng dữ liệu" hoặc dữ liệu đã gắn role
 *    trong key.
 *  - Hết TTL → block một lần reload (KHÔNG stale-serve): dashboard là số liệu
 *    điều hành, trả số cũ quá TTL dễ gây quyết định sai. v3.6 dùng
 *    stale-while-revalidate vì SQLite đồng bộ block event loop; v5 pool async
 *    không có ràng buộc đó nên đổi hành vi CÓ CHỦ ĐỊCH (ghị chú port).
 */

/** Giá trị đã settle (`v` + `at` = lúc settle) và/hoặc Promise đang load. */
interface CacheEntry {
  v: unknown;
  at: number;
  loading?: Promise<unknown>;
}

/** Module-level store — một Map duy nhất cho cả tiến trình (port v3.6 dòng 11). */
const store = new Map<string, CacheEntry>();

/** TTL mặc định 15s — port v3.6 DEFAULT_TTL (dòng 12) cho các fn không ghi rõ. */
export const DEFAULT_TTL_MS = 15_000;

/**
 * Đọc qua cache: còn hạn → trả ngay; đang có lời gọi cùng key → dùng lại
 * Promise (single-flight, chống N request đồng thời cùng bắn DB); hết hạn /
 * chưa có → chạy loader MỘT lần rồi cache lại.
 *
 * @param key     Khóa phân vùng (BẮT BUỘC tự chứa role/ngữ cảnh nếu dữ liệu
 *                phân quyền — xem quy ước an toàn đầu file).
 * @param ttlMs   Tuổi thọ tính từ lúc loader resolve xong.
 * @param loader  Hàm nạp bất đồng bộ; ném lỗi sẽ KHÔNG bị cache.
 */
export function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const e = store.get(key);
  if (e) {
    // Single-flight: người đến sau trong lúc đang load → cùng một Promise.
    if (e.loading) return e.loading as Promise<T>;
    // Cache hit còn hạn.
    if (Date.now() - e.at < ttlMs) return Promise.resolve(e.v as T);
  }

  // So khớp theo THAM CHIẾU entry (không tự tham chiếu biến Promise — tránh
  // TS2454 "used before being assigned" + chống race khi cached() bị gọi lại).
  const entry: CacheEntry = { v: e ? e.v : undefined, at: e ? e.at : 0 };
  const loading: Promise<T> = (async (): Promise<T> => {
    try {
      const v = await loader();
      if (store.get(key) === entry) {
        // settle thành công trên đúng phiên load → trở thành bản fresh
        // (at = lúc CÓ dữ liệu, không phải lúc bắt đầu load).
        entry.v = v;
        entry.at = Date.now();
        entry.loading = undefined;
      } else if (!store.has(key)) {
        // Entry bị clearPrefix()/ghi đè trong lúc đang load → ghi bản mới nhất
        // nếu key trống (best-effort; clearPrefix là lệnh xóa, không được
        // "hồi sinh" dữ liệu bị xóa chủ động).
        store.set(key, { v, at: Date.now() });
      }
      return v;
    } catch (err) {
      // KHÔNG cache lỗi (v3.6 dòng 7) → lần sau loader chạy lại.
      if (store.get(key) === entry) store.delete(key);
      throw err;
    }
  })();
  entry.loading = loading;

  // Giữ dữ cũ (nếu re-fetch sau khi hết hạn) trong lúc loading để caller sau
  // thấy `entry.loading` và dùng lại Promise này (single-flight).
  store.set(key, entry);
  return loading;
}

/**
 * Xóa mọi key bắt đầu bằng `prefix`. Trả về số key đã xóa (hữu ích cho test
 * + log truy vết). `prefix === ''` → clear ALL (port v3.6 clearPrefix dòng
 * 52–55: `!pre → map.clear()` gộp chung một hàm).
 *
 * Lưu ý: Promise đang load của key bị xóa KHÔNG bị hủy — khi resolve xong nó
 * thấy entry không còn đúng phiên bản load nên KHÔNG ghi đè (tránh dữ liệu
 * "hồi sinh" sau invalidate, xem nhánh best-effort trong cached()).
 */
export function clearPrefix(prefix: string): number {
  if (!prefix) {
    const n = store.size;
    store.clear();
    return n;
  }
  let n = 0;
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) {
      store.delete(k);
      n++;
    }
  }
  return n;
}
