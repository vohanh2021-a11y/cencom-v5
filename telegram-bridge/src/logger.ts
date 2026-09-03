type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";
const order: Record<Level, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let current: Level = "INFO";

export function setLevel(l: Level): void {
  current = l;
}

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/token|secret|key|password|authorization/i.test(k)) out[k] = "<redacted>";
    else out[k] = v;
  }
  return out;
}

export function log(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (order[level] < order[current]) return;
  const ts = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(sanitize(meta)) : "";
  process.stdout.write(`[${ts}] [${level}] ${msg}${metaStr}\n`);
}
