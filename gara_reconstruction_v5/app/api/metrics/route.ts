/**
 * app/api/metrics/route.ts — Prometheus metrics endpoint (PUBLIC, no auth)
 *
 * GET /api/metrics
 * Response: text/plain; version=0.0.4 — Prometheus exposition format
 *
 * Metrics trong registry:
 *   http_requests_total, login_fail_total, rpc_errors_total, sc_created_total
 */

import { NextResponse } from 'next/server';
import { renderMetrics } from '../../../lib/metrics';
import { createLogger } from '../../../lib/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('metrics');

export async function GET() {
  logger.info('Metrics requested');
  const body = renderMetrics();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    },
  });
}
