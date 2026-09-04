/**
 * app/api/health/route.ts — Health check endpoint (PUBLIC, no auth)
 *
 * GET /api/health
 * 200: { ok: true, db: 'up', uptimeSec, version, ts }
 * 503: { ok: false, db: 'down', error: '...', uptimeSec, version, ts }
 *
 * Ping DB bang SELECT 1 — khong lo connection string.
 */

import { NextResponse } from 'next/server';
import { q } from '../../../lib/db';
import { createLogger } from '../../../lib/logger';
// Version ĐỌC TĨNH từ package.json (resolveJsonModule bật): trước đây lấy
// npm_package_version — RỖNG khi chạy `node server.js` trực tiếp
// (electron standalone spawn + Docker CMD) → health mãi báo '5.0.0' ảo.
import pkg from '../../../package.json';

export const dynamic = 'force-dynamic';

const logger = createLogger('health');

const START_TIME = Date.now();

export async function GET() {
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const version = (pkg as { version?: string }).version || '0.0.0';
  const ts = new Date().toISOString();

  try {
    await q('SELECT 1');
    logger.info('Health check OK', { db: 'up', uptimeSec });

    return NextResponse.json({
      ok: true,
      db: 'up',
      uptimeSec,
      version,
      ts,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Unknown DB error';
    logger.error('Health check FAILED — DB down', { error: errMsg });

    return NextResponse.json(
      {
        ok: false,
        db: 'down',
        error: 'Database connection failed',
        uptimeSec,
        version,
        ts,
      },
      { status: 503 },
    );
  }
}
