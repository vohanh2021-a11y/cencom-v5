/**
 * lib/metrics.ts — Lightweight in-memory Prometheus-style metrics registry
 *
 * Khong dung prom-client — tu viet don gian voi Map<string, number>.
 * Export ham inc() de bat ky module nao goi duoc.
 * Render thanh Prometheus text format khi GET /api/metrics.
 *
 * Metrics duoc define:
 *   http_requests_total{method, path, status}  — counter
 *   login_fail_total{reason}                   — counter
 *   rpc_errors_total{fn, error}                — counter
 *   sc_created_total{status}                   — counter
 */

// ─── Metric definitions (HELP + TYPE) ─────────────────────────────

interface MetricDef {
  help: string;
  type: 'counter' | 'gauge';
}

const METRIC_DEFS: Record<string, MetricDef> = {
  http_requests_total: {
    help: 'Total HTTP requests',
    type: 'counter',
  },
  login_fail_total: {
    help: 'Total failed login attempts',
    type: 'counter',
  },
  rpc_errors_total: {
    help: 'Total RPC handler errors',
    type: 'counter',
  },
  sc_created_total: {
    help: 'Total phieu sua chua created',
    type: 'counter',
  },
};

// ─── In-memory store ───────────────────────────────────────────────

/**
 * Key format: "metricName{label1=val1,label2=val2,...}"
 * Example: 'http_requests_total{method="GET",path="/api/rpc",status="200"}'
 */
const store = new Map<string, number>();

/** Serialize labels object to Prometheus label string: {method:"GET"} -> method="GET" */
function labelsKey(labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return parts ? `{${parts}}` : '';
}

/** Increase a metric by 1 (default) or a custom delta */
export function inc(
  metric: string,
  labels: Record<string, string> = {},
  delta: number = 1,
): void {
  const key = `${metric}${labelsKey(labels)}`;
  store.set(key, (store.get(key) ?? 0) + delta);
}

/** Get current value of a metric (for testing/debug) */
export function getMetricValue(
  metric: string,
  labels: Record<string, string> = {},
): number {
  const key = `${metric}${labelsKey(labels)}`;
  return store.get(key) ?? 0;
}

// ─── Prometheus text renderer ───────────────────────────────────────

export function renderMetrics(): string {
  const lines: string[] = [];

  // Group store entries by metric name
  const grouped = new Map<string, Array<{ labels: string; value: number }>>();

  for (const [key, value] of store) {
    const braceIdx = key.indexOf('{');
    const name = braceIdx >= 0 ? key.slice(0, braceIdx) : key;
    const labels = braceIdx >= 0 ? key.slice(braceIdx) : '';

    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push({ labels, value });
  }

  // Emit in order of METRIC_DEFS, then any unknown metrics
  const emitted = new Set<string>();

  for (const [name, def] of Object.entries(METRIC_DEFS)) {
    emitted.add(name);
    lines.push(`# HELP ${name} ${def.help}`);
    lines.push(`# TYPE ${name} ${def.type}`);
    const entries = grouped.get(name) ?? [];
    for (const { labels, value } of entries) {
      lines.push(`${name}${labels} ${value}`);
    }
    // If no entries yet, still emit nothing (Prometheus prefers empty than 0 for counters)
  }

  // Emit any extra metrics not in METRIC_DEFS
  for (const [name, entries] of grouped) {
    if (!emitted.has(name)) {
      lines.push(`# HELP ${name} ${name}`);
      lines.push(`# TYPE ${name} counter`);
      for (const { labels, value } of entries) {
        lines.push(`${name}${labels} ${value}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}
