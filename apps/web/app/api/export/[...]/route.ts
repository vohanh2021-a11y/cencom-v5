/**
 * GET /api/export/[...] — Export Excel (stream).
 *
 * Các loại export hỗ trợ:
 * - /api/export/tonkho — Tồn kho
 * - /api/export/phxuat/:id — Phiếu xuất
 * - /api/export/quyettoan/:scId — Quyết toán
 * - /api/export/dexuat — Danh sách đề xuất
 *
 * Requires auth (x-session-token).
 * Lỗi trả text (client dùng window.open).
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as core from '@cencom/core';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const token = request.headers.get('x-session-token') || request.headers.get('cookie')?.match(/cen_session=([^;]+)/)?.[1];
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const db = core.createDb(core.makePgExecutor(pool));

  // Resolve user
  const userResult = await pool.query(
    `SELECT u.id, u.name, u.role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );

  if (userResult.rows.length === 0) {
    await pool.end();
    return new Response('Session expired', { status: 401 });
  }

  const user = userResult.rows[0];

  // Check permission
  const _p = await params as any; const segs: string[] = _p?.path ?? Object.values(_p)[0];
  const kind = segs[0];

  try {
    let buffer: Buffer;
    let filename: string;

    switch (kind) {
      case 'tonkho': {
        // Check perm: kho.xem
        const can = await core.perm.can(db, user.role, 'kho', 'xem');
        if (!can) return new Response('Forbidden', { status: 403 });
        const wb = await core.report.buildTonKhoWorkbook({ db } as any);
        buffer = Buffer.from(wb);
        filename = `tonkho_${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      case 'phxuat': {
        const id = segs[1] ?? '';
        if (!id) return new Response('Missing phiếu ID', { status: 400 });
        const can = await core.perm.can(db, user.role, 'kho', 'xem');
        if (!can) return new Response('Forbidden', { status: 403 });
        const wb = await core.report.buildPhXuatWorkbook({ db } as any, id);
        buffer = Buffer.from(wb);
        filename = `phieuxuat_${id}.xlsx`;
        break;
      }
      case 'quyettoan': {
        const scId = segs[1] ?? '';
        if (!scId) return new Response('Missing SC ID', { status: 400 });
        const can = await core.perm.can(db, user.role, 'asset', 'xem');
        if (!can) return new Response('Forbidden', { status: 403 });
        const wb = await core.report.buildQuyetToanWorkbook({ db } as any, scId);
        buffer = Buffer.from(wb);
        filename = `quyettoan_${scId}.xlsx`;
        break;
      }
      case 'dexuat': {
        const can = await core.perm.can(db, user.role, 'de_xuat', 'xem');
        if (!can) return new Response('Forbidden', { status: 403 });
        const wb = await core.report.buildDeXuatWorkbook({ db } as any);
        buffer = Buffer.from(wb);
        filename = `dexuat_${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      case 'sc-hoso': {
        const scId = segs[1] ?? '';
        if (!scId) return new Response('Missing SC ID', { status: 400 });
        const can = await core.perm.can(db, user.role, 'report', 'xem');
        if (!can) return new Response('Forbidden', { status: 403 });
        // Giới hạn role: chỉ lãnh đạo/xưởng/kế toán được tải toàn bộ hồ sơ (có chi phí)
        const ALLOW = ['admin', 'giamdoc', 'ketoan'];
        if (!ALLOW.includes(user.role)) return new Response('Forbidden', { status: 403 });
        const wb = await core.report.scHoSoXlsx({ db } as any, scId);
        buffer = Buffer.from(wb);
        filename = `hoso_${scId}.xlsx`;
        break;
      }
      default:
        return new Response('Unknown export type', { status: 404 });
    }

    await pool.end();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[EXPORT] Error:', err);
    await pool.end();
    return new Response('Export failed', { status: 500 });
  }
}
