/**
 * W3.2 — Conformance: lib/cache.ts (async, single-flight) + wrapper
 * dashboardAllCached / invalidateDashCache trong lib/core/xuong.ts.
 * Port ý nghĩa v3.6 `server/cache.js` + `xuong.js` dòng 296–307.
 *
 * Phong cách: gọi HÀM CORE TRỰC TIẾP (pattern xuong_kanban / kho_tonkho —
 * không HTTP, không cổng :3000). Hai lớp test:
 *  (A) cache.ts THUẦN bằng loader tự định nghĩa (không đụng DB) — chứng minh
 *      hit/miss/single-flight/TTL/clearPrefix/không-cache-khi-lỗi.
 *  (B) dashboardAllCached qua DB thật (globalSetup đã migrate+seed) — chứng
 *      minh wiring dùng ĐÚNG cached() qua bộ đếm test-only
 *      __dashAllCallCount (jest.spyOn không chặn được call binding cục bộ —
 *      xem comment khai báo counter trong lib/core/xuong.ts).
 *
 * beforeAll trong tests/conformance/setup.ts (login 5 user) tự chạy theo
 * jest.config setupFilesAfterEnv — file này không cần token HTTP.
 *
 * Cô lập: mọi key nằm trong namespace 't:' (cache thuần) và 'dash:' (xuong);
 * beforeEach clearPrefix cả hai + reset counter — store module-level dùng
 * chung cả file nên không được để TC này đọc cache của TC kia.
 */
import { buildApi } from '../../lib/api';
import { cached, clearPrefix } from '../../lib/cache';
import {
  dashboardAllCached,
  invalidateDashCache,
  __dashAllCallCount,
  __resetDashAllCallCount,
} from '../../lib/core/xuong';

const apiXuong = buildApi({ id: 'U-XUONG', name: 'xuong', role: 'xuong' });
const apiAdmin = buildApi({ id: 'U-ADMIN', name: 'admin', role: 'admin' });
const apiKetoan = buildApi({ id: 'U-KETOAN', name: 'ketoan', role: 'ketoan' });
const apiAnon = buildApi(null);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Ngày UTC YYYY-MM-DD — đúng công thức tạo key trong dashboardAllCached. */
const today = () => new Date().toISOString().split('T')[0];

jest.setTimeout(60000);

beforeEach(() => {
  clearPrefix('t:');
  clearPrefix('dash:');
  __resetDashAllCallCount();
});

describe('W3.2 — lib/cache.ts cached(): TTL + single-flight + clearPrefix (loader mock, không DB)', () => {
  test('C1 — còn hạn: 2 lời gọi TUẦN TỰ cùng key → loader đúng 1 lần, cùng tham chiếu', async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      return { ok: true, n: calls };
    };
    const r1 = await cached('t:c1', 5_000, loader);
    const r2 = await cached('t:c1', 5_000, loader);
    expect(calls).toBe(1);
    expect(r2).toBe(r1); // cùng chính đối tượng lưu trong cache
    expect(r1).toEqual({ ok: true, n: 1 });
  });

  test('C2 — single-flight: 3 lời gọi ĐỒNG THỜI cùng key → loader 1 lần', async () => {
    let calls = 0;
    const loader = async () => {
      calls++;
      await sleep(30); // mở cửa sổ "đang load" cho caller ập vào sau
      return { seq: calls };
    };
    const [a, b, c] = await Promise.all([
      cached('t:c2', 5_000, loader),
      cached('t:c2', 5_000, loader),
      cached('t:c2', 5_000, loader),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test('C3 — hết TTL: ttl=30ms + sleep 60ms → lần 2 loader THỰC CHẠY (không stale-serve)', async () => {
    let calls = 0;
    const loader = async () => ({ ok: true, n: ++calls });
    const first = await cached('t:c3', 30, loader);
    await sleep(60);
    const second = await cached('t:c3', 30, loader);
    expect(calls).toBe(2);
    expect(first).toEqual({ ok: true, n: 1 });
    expect(second).toEqual({ ok: true, n: 2 });
  });

  test('C4 — ttl=0: luôn expired → mỗi lời gọi chạy loader', async () => {
    let calls = 0;
    const loader = async () => ++calls;
    await cached('t:c4', 0, loader);
    await cached('t:c4', 0, loader);
    expect(calls).toBe(2);
  });

  test('C5 — loader NÉM LỖI: lỗi tung lên caller, KHÔNG cache; lần sau thử lại', async () => {
    let calls = 0;
    const flaky = async () => {
      calls++;
      throw new Error('boom-' + calls);
    };
    await expect(cached('t:c5', 5_000, flaky)).rejects.toThrow('boom-1');
    await expect(cached('t:c5', 5_000, flaky)).rejects.toThrow('boom-2');
    const good = async () => {
      calls++;
      return 'ok';
    };
    expect(await cached('t:c5', 5_000, good)).toBe('ok');
    expect(await cached('t:c5', 5_000, good)).toBe('ok');
    expect(calls).toBe(3); // 2 lần fail + 1 lần thành công; hit thứ hai ăn cache
  });

  test('C6 — clearPrefix quét ĐÚNG namespace, trả số key xóa; namespace khác nguyên', async () => {
    let nT = 0;
    let nOther = 0;
    const lT = async () => ++nT;
    const lOther = async () => ++nOther;
    await cached('t:c6a', 5_000, lT);
    await cached('t:c6b', 5_000, lT);
    await cached('other:c6', 5_000, lOther); // ngoài namespace 't:'

    expect(clearPrefix('t:')).toBe(2);

    await cached('t:c6a', 5_000, lT);      // mất cache → loader chạy lại
    await cached('other:c6', 5_000, lOther); // vẫn còn → không đếm thêm
    expect(nT).toBe(3);
    expect(nOther).toBe(1);
  });

  test('C7 — key phân vùng: cùng loader, khác key → hai mục cache độc lập', async () => {
    let calls = 0;
    const loader = async () => ++calls;
    await cached('t:c7a', 5_000, loader);
    await cached('t:c7b', 5_000, loader);
    expect(calls).toBe(2);
  });
});

describe('W3.2 — xuong.dashboardAllCached + invalidateDashCache (DB thật, core trực tiếp)', () => {
  test('X1 — 2 lần gọi liên tiếp cùng role → dashboardAll chỉ chạy 1 lần (cache hit)', async () => {
    const r1 = await dashboardAllCached(apiXuong);
    const r2 = await dashboardAllCached(apiXuong);
    expect(r1.ok).toBe(true);
    expect(r1.result?.today).toBe(today());
    expect(r2).toBe(r1); // nguyên khối envelope được cache (cùng reference)
    expect(__dashAllCallCount()).toBe(1);
  });

  test('X2 — single-flight qua DB: 2 request đồng thời → loader 1 lần', async () => {
    const [a, b] = await Promise.all([
      dashboardAllCached(apiXuong),
      dashboardAllCached(apiXuong),
    ]);
    expect(a).toBe(b);
    expect(a.ok).toBe(true);
    expect(__dashAllCallCount()).toBe(1);
  });

  test('X3 — key theo ROLE: xuong vs admin → 2 lần loader độc lập, không lộ chéo bản cache', async () => {
    const rx = await dashboardAllCached(apiXuong);
    const ra = await dashboardAllCached(apiAdmin);
    expect(rx.ok).toBe(true);
    expect(ra.ok).toBe(true);
    expect(rx).not.toBe(ra); // khác key `dash:<role>:<ngày>` → khác object
    expect(__dashAllCallCount()).toBe(2);
  });

  test('X4 — envelope 403 (ketoan) & 401 (anon) cũng được cache — đúng chất v3.6', async () => {
    const k1 = await dashboardAllCached(apiKetoan);
    const k2 = await dashboardAllCached(apiKetoan);
    expect(k1).toEqual({ ok: false, error: '403' });
    expect(k2).toBe(k1); // key 'dash:ketoan:...' — 403 không chứa dữ liệu → vô hại
    expect(__dashAllCallCount()).toBe(1); // miss 1 lần (ketoan), hit không đếm

    const a1 = await dashboardAllCached(apiAnon);
    const a2 = await dashboardAllCached(apiAnon);
    expect(a1).toEqual({ ok: false, error: '401' });
    expect(a2).toBe(a1);
    expect(__dashAllCallCount()).toBe(2); // +1 lần miss cho key anon 'dash::...'
  });

  test('X5 — invalidateDashCache(): clearPrefix dash: → lần gọi sau loader chạy lại', async () => {
    await dashboardAllCached(apiXuong); // miss → loader 1
    await dashboardAllCached(apiKetoan); // miss (role khác) → loader 2
    expect(__dashAllCallCount()).toBe(2);

    expect(invalidateDashCache()).toBe(2); // đúng 2 key 'dash:' đang sống (xuong + ketoan)

    const after = await dashboardAllCached(apiXuong);
    expect(after.ok).toBe(true);
    expect(__dashAllCallCount()).toBe(3); // cold → loader lại
  });

  test('X6 — cấu trúc key: cùng ngày UTC → hit; result.today khớp ngày dựng key (lệch có chủ đích so với v3.6)', async () => {
    const res = await dashboardAllCached(apiXuong);
    expect(res.ok).toBe(true);
    expect(res.result?.today).toBe(today()); // KPI 'hôm nay' gắn đúng ngày UTC
    const again = await dashboardAllCached(apiXuong);
    expect(again).toBe(res);
    expect(__dashAllCallCount()).toBe(1);
  });
});
