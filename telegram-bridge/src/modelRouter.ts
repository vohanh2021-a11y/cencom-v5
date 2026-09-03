export interface ModelEntry {
  /** opencode model id, dạng "provider/model", vd: "opencode/hy3-free", "2009/mimo-v2.5" */
  id: string;
  /** nhãn provider để log/chẩn đoán: "zen" | "b.ai" */
  provider: string;
}

export interface ModelRouterConfig {
  pool: ModelEntry[];
  /** Thời gian 1 model bị "cách ly" sau khi lỗi thật (429/5xx). */
  cooldownMs: number;
  /** Số lần thử tối đa mỗi tin nhắn trước khi bỏ cuộc. */
  maxAttempts: number;
  /** Thời gian tối thiểu giữ nguyên 1 model trước khi xoay vòng định kỳ. */
  dwellMs?: number;
}

interface Health {
  failures: number;
  cooldownUntil: number;
}

/**
 * ModelRouter – chọn model tự động cho bridge Hermes.
 *
 * Quy tắc switch (theo yêu cầu người dùng):
 *  - Chỉ đổi model khi (1) đủ dwellMs (mặc định 30 phút) sử dụng 1 model, HOẶC
 *    (2) model hiện tại thực sự lỗi (429 / 5xx / network) – gọi fail().
 *  - KHÔNG đổi chỉ vì model chậm (timeout đầu chunk được đặt rất cao, ~5 phút).
 *  - Khi đổi, ưu tiên sang provider KHÁC (zen <-> b.ai) để dàn tải / tránh limit dồn 1 key.
 */
export class ModelRouter {
  private index = 0;
  private health = new Map<string, Health>();
  private dwellUntil = 0;

  constructor(public readonly cfg: ModelRouterConfig) {
    if (cfg.pool.length === 0) throw new Error("ModelRouter: pool must not be empty");
    this.dwellUntil = Date.now() + (cfg.dwellMs ?? 30 * 60 * 1000);
  }

  get current(): ModelEntry {
    return this.cfg.pool[this.index % this.cfg.pool.length];
  }

  get size(): number {
    return this.cfg.pool.length;
  }

  /** Đánh dấu model hiện tại thành công (xóa cooldown). */
  succeed(): void {
    const cur = this.current;
    this.health.set(cur.id, { failures: 0, cooldownUntil: 0 });
  }

  /**
   * Đánh dấu model hiện tại thất bại THẬT (429/5xx/network), tiến tới model khỏe mạnh kế tiếp.
   * Ưu tiên chuyển SANG provider KHÁC (zen <-> b.ai).
   */
  fail(): ModelEntry {
    const cur = this.current;
    const st = this.health.get(cur.id) ?? { failures: 0, cooldownUntil: 0 };
    st.failures += 1;
    st.cooldownUntil = Date.now() + this.cfg.cooldownMs;
    this.health.set(cur.id, st);
    this.index = this.nextHealthyIndex(cur.provider);
    this.setDwell();
    return this.current;
  }

  /**
   * Xoay vòng ĐỊNH KỲ: chỉ trả về model mới khi đã đủ dwellMs kể từ lần chọn trước.
   * Trả về null nếu chưa tới hạn (giữ nguyên model hiện tại).
   */
  rotateProactively(): ModelEntry | null {
    if (!this.shouldRotateByTime(Date.now())) return null;
    this.index = this.nextHealthyIndex(this.current.provider);
    this.setDwell();
    return this.current;
  }

  shouldRotateByTime(now: number): boolean {
    return now >= this.dwellUntil;
  }

  private setDwell(): void {
    this.dwellUntil = Date.now() + (this.cfg.dwellMs ?? 30 * 60 * 1000);
  }

  private isHealthy(e: ModelEntry, now: number): boolean {
    const st = this.health.get(e.id);
    return !st || st.cooldownUntil <= now;
  }

  /**
   * Chọn index khỏe mạnh kế tiếp.
   * - Ưu tiên model thuộc provider KHÁC với failedProvider (cross-provider switch).
   * - Nếu không còn provider khác khỏe, fallback bất kỳ model khỏe nào.
   * - Nếu tất cả đang cooldown, giữ nguyên index.
   */
  private nextHealthyIndex(failedProvider?: string): number {
    const n = this.cfg.pool.length;
    const now = Date.now();
    if (failedProvider) {
      for (let step = 1; step <= n; step++) {
        const idx = (this.index + step) % n;
        const e = this.cfg.pool[idx];
        if (this.isHealthy(e, now) && e.provider !== failedProvider) return idx;
      }
    }
    for (let step = 1; step <= n; step++) {
      const idx = (this.index + step) % n;
      if (this.isHealthy(this.cfg.pool[idx], now)) return idx;
    }
    return this.index;
  }

  /** Trạng thái từng model – dùng cho chẩn đoán (/models, /status). */
  status(): Array<{ id: string; provider: string; healthy: boolean; cooldownSec: number }> {
    const now = Date.now();
    return this.cfg.pool.map((e) => {
      const st = this.health.get(e.id);
      const cooling = st ? st.cooldownUntil - now : 0;
      return {
        id: e.id,
        provider: e.provider,
        healthy: !st || st.cooldownUntil <= now,
        cooldownSec: cooling > 0 ? Math.ceil(cooling / 1000) : 0,
      };
    });
  }
}
