/**
 * Unit test cho lib/rateLimit.ts
 * Chạy: npx jest tests/rateLimit.test.ts --no-cache
 */
import { rateLimit, _resetStore } from '../../lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    _resetStore();
  });

  test('allows requests under the limit', () => {
    const result = rateLimit('ip-1', 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  test('blocks requests over the limit', () => {
    // Drain the limit: 3 allowed
    rateLimit('ip-2', 3, 60_000);
    rateLimit('ip-2', 3, 60_000);
    rateLimit('ip-2', 3, 60_000);

    // 4th request should be blocked
    const result = rateLimit('ip-2', 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  test('different keys are independent', () => {
    // Exhaust ip-A's limit
    rateLimit('ip-A', 1, 60_000);
    rateLimit('ip-A', 1, 60_000);
    const blockedA = rateLimit('ip-A', 1, 60_000);
    expect(blockedA.allowed).toBe(false);

    // ip-B should still be allowed
    const allowedB = rateLimit('ip-B', 1, 60_000);
    expect(allowedB.allowed).toBe(true);
  });

  test('window resets after expiry', () => {
    // Use a very short window for testing
    rateLimit('ip-c', 1, 1); // 1ms window
    const blocked = rateLimit('ip-c', 1, 1);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const allowed = rateLimit('ip-c', 1, 1);
        expect(allowed.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });

  test('_resetStore clears all entries', () => {
    rateLimit('ip-d', 1, 60_000);
    const blocked = rateLimit('ip-d', 1, 60_000);
    expect(blocked.allowed).toBe(false);

    _resetStore();

    const allowed = rateLimit('ip-d', 1, 60_000);
    expect(allowed.allowed).toBe(true);
  });

  test('simulates brute-force login: 5 attempts then blocked', () => {
    const limit = 5;
    const windowMs = 5 * 60 * 1000;

    // 5 allowed attempts
    for (let i = 0; i < limit; i++) {
      const r = rateLimit('attacker', limit, windowMs);
      expect(r.allowed).toBe(true);
      expect(r.retryAfterMs).toBe(0);
    }

    // 6th attempt blocked
    const blocked = rateLimit('attacker', limit, windowMs);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(windowMs);
  });
});
