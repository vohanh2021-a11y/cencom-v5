/**
 * lib/logger.ts — Structured logger cho CencomOS Gara v5
 *
 * Format: [2026-08-20T12:00:00.000Z] INFO module=auth message="Dang nhap thanh cong" userId=USR-000001
 * Secret redaction: bat ky field nao chua token/password/cookie/secret/apikey -> [REDACTED]
 * Level control: env LOG_LEVEL = 'debug' | 'info' (default) | 'warn' | 'error'
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const envLevel: Level = (process.env.LOG_LEVEL?.toLowerCase() as Level) || 'info';
const currentLevel = LEVELS[envLevel] ?? LEVELS.info;

/** Keys canh bao la secret — value se bi redact */
const SECRET_KEYS = /token|password|passwd|pwd|cookie|secret|apikey|api_key|authorization|session|credential/i;

/** Redact object: neu co key matching SECRET_KEYS -> value = [REDACTED] */
function redactMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEYS.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string' && SECRET_KEYS.test(k) === false) {
      // Also scan string values for bare tokens/secrets
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function format(level: Level, module: string, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  let line = `[${ts}] ${levelStr} module=${module} message="${msg}"`;
  const redacted = redactMeta(meta);
  if (redacted && Object.keys(redacted).length > 0) {
    for (const [k, v] of Object.entries(redacted)) {
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      line += ` ${k}=${val}`;
    }
  }
  return line;
}

function log(level: Level, module: string, msg: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < currentLevel) return;
  const line = format(level, module, msg, meta);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * Create a scoped logger for a module.
 * @param moduleName  Ten module (vd: 'auth', 'rpc', 'health', 'metrics')
 */
export function createLogger(moduleName: string) {
  return {
    debug(msg: string, meta?: Record<string, unknown>) {
      log('debug', moduleName, msg, meta);
    },
    info(msg: string, meta?: Record<string, unknown>) {
      log('info', moduleName, msg, meta);
    },
    warn(msg: string, meta?: Record<string, unknown>) {
      log('warn', moduleName, msg, meta);
    },
    error(msg: string, meta?: Record<string, unknown>) {
      log('error', moduleName, msg, meta);
    },
  };
}

/** Default logger (module = 'app') */
export const logger = createLogger('app');
