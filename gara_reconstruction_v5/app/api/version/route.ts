import { NextResponse } from 'next/server';
import pkg from '../../../package.json';

/**
 * GET /api/version — deploy governance §4: client/ops xác nhận bản đang chạy
 * mà không cần đăng nhập (chỉ trả version, không lộ gì khác).
 * Dùng cho: smoke sau deploy, Hub/Spoke tự nhận bản mới, đối chiếu tag.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { version: (pkg as { version?: string }).version || '0.0.0' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
