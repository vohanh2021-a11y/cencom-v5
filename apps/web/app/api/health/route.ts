/**
 * GET /api/health — Health check endpoint (ẩn path).
 *
 * Trả về { ok: true, status: 'healthy', timestamp } nếu server đang chạy.
 * Dùng cho Docker HEALTHCHECK.
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    // Kiểm tra DB connection
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 1,
      connectionTimeoutMillis: 5000,
    });

    try {
      await pool.query('SELECT 1');
    } finally {
      await pool.end();
    }

    return NextResponse.json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[HEALTH] DB connection failed:', err);
    return NextResponse.json(
      {
        ok: false,
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
