/**
 * lib/observability.ts — Observability facade cho CencomOS Gara v5
 *
 * Cap vao logger.ts da co (createLogger), cung cap ham chuan:
 *   logInfo(msg, meta?)   — log thong tin binh thuong
 *   logWarn(msg, meta?)   — canh bao
 *   logError(msg, err, meta?) — loi voi stack trace
 *   createScopedLogger(module) — tao logger co scope ro rang
 *
 * Su dung: import { logInfo, logError } from '@/lib/observability';
 *          logError('RPC handler failed', error, { fn: 'scCreate' });
 *
 * Env: LOG_LEVEL = debug | info (default) | warn | error
 */

import { createLogger, logger as defaultLogger } from './logger';

// ─── Interface ──────────────────────────────────────────────────────

interface ScopedLogger {
  logInfo(msg: string, meta?: Record<string, unknown>): void;
  logWarn(msg: string, meta?: Record<string, unknown>): void;
  logError(msg: string, err?: unknown, meta?: Record<string, unknown>): void;
}

// ─── Error serializer ──────────────────────────────────────────────

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const meta: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    if (err.stack) {
      meta.stack = err.stack;
    }
    // Capture non-standard properties (e.g., code, status, cause)
    for (const key of Object.keys(err)) {
      if (key !== 'name' && key !== 'message' && key !== 'stack') {
        meta[key] = (err as unknown as Record<string, unknown>)[key];
      }
    }
    return meta;
  }
  if (typeof err === 'string') {
    return { message: err };
  }
  if (err && typeof err === 'object') {
    return { raw: String(err) };
  }
  return { raw: String(err) };
}

// ─── Global convenience functions (module = 'app') ──────────────────

/**
 * Log thong tin binh thuong (level INFO).
 * @example logInfo('Server started', { port: 3000 });
 */
export function logInfo(msg: string, meta?: Record<string, unknown>): void {
  defaultLogger.info(msg, meta);
}

/**
 * Log canh bao (level WARN).
 * @example logWarn('Rate limit approaching', { ip: '192.168.1.1', count: 45 });
 */
export function logWarn(msg: string, meta?: Record<string, unknown>): void {
  defaultLogger.warn(msg, meta);
}

/**
 * Log loi voi stack trace (level ERROR).
 * @example logError('RPC handler failed', error, { fn: 'scCreate', userId: 'USR-000001' });
 */
export function logError(
  msg: string,
  err?: unknown,
  meta?: Record<string, unknown>,
): void {
  const errorMeta = err ? serializeError(err) : {};
  const merged = { ...meta, ...errorMeta };
  defaultLogger.error(msg, merged);
}

// ─── Scoped logger factory ──────────────────────────────────────────

/**
 * Tao logger voi module name cu the — moi dong log deu co `module=<name>`.
 * @example
 *   const rpcLog = createScopedLogger('rpc');
 *   rpcLog.logError('Dispatch failed', err, { fn: 'scCreate' });
 */
export function createScopedLogger(moduleName: string): ScopedLogger {
  const scoped = createLogger(moduleName);
  return {
    logInfo(msg: string, meta?: Record<string, unknown>): void {
      scoped.info(msg, meta);
    },
    logWarn(msg: string, meta?: Record<string, unknown>): void {
      scoped.warn(msg, meta);
    },
    logError(
      msg: string,
      err?: unknown,
      meta?: Record<string, unknown>,
    ): void {
      const errorMeta = err ? serializeError(err) : {};
      const merged = { ...meta, ...errorMeta };
      scoped.error(msg, merged);
    },
  };
}

// ─── Unhandled rejection handler (setup 1 lan duy nhat) ─────────────

let _rejectionHandlerInstalled = false;

/**
 * Dang ky global handler bat unhandledRejection + uncaughtException.
 * Goi 1 lan duy nhat o server startup (middleware / globalSetup / server.ts).
 * KHONG goi o client-side (browser).
 */
export function installGlobalErrorHandlers(): void {
  if (_rejectionHandlerInstalled) return;
  if (typeof window !== 'undefined') return; // chi server
  // Guard: trong một số runtime (Next instrumentation sandbox / edge) `process`
  // có thể không có `.on` — không được phép làm crash quá trình khởi động.
  if (typeof process === 'undefined' || typeof process.on !== 'function') return;

  _rejectionHandlerInstalled = true;

  process.on('unhandledRejection', (reason, promise) => {
    logError('Unhandled rejection', reason, {
      context: 'process.unhandledRejection',
    });
  });

  process.on('uncaughtException', (err) => {
    logError('Uncaught exception (process will crash)', err, {
      context: 'process.uncaughtException',
    });
    // Cho phep process exit sau khi da log (default behavior cua Node)
  });
}
