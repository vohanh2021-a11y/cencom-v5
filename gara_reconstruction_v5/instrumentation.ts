/**
 * instrumentation.ts — Next.js instrumentation hook
 *
 * Export register() called once at server startup.
 * Sets up global error handlers via observability lib.
 * Only runs on server (not edge/client).
 */

import { installGlobalErrorHandlers } from './lib/observability';

export function register(): void {
  // Only install on server-side (Node.js runtime)
  if (typeof window === 'undefined') {
    installGlobalErrorHandlers();
  }
}