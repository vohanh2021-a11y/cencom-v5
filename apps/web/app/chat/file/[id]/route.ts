/**
 * GET /chat/file/[id] — Tải ảnh chat từ Storage (on-premise).
 *
 * Require auth (x-session-token). Trả về file với Content-Disposition: attachment.
 * Ảnh cũ sau 1 ngày (file đã xoá) → 404.
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { downloadChatImage } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const token = request.headers.get('x-session-token');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Resolve user
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    const userResult = await pool.query(
      `SELECT u.id, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token],
    );

    if (userResult.rows.length === 0) {
      return new Response('Session expired', { status: 401 });
    }

    // Download từ Storage
    const filePath = params.id; // path trong bucket
    const buffer = await downloadChatImage(filePath);

    if (!buffer) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="chat_image.png"',
      },
    });
  } catch (err) {
    console.error('[CHAT FILE] Error:', err);
    return new Response('Error', { status: 500 });
  } finally {
    await pool.end();
  }
}
