/**
 * lib/supabase.ts — Supabase client config cho On-Premise (self-hosted Docker).
 *
 * Không dùng Supabase managed cloud. Dùng self-hosted stack:
 * - Realtime: ws://localhost:54324 (supabase-realtime container)
 * - Storage: http://localhost:54325 (supabase-storage-api container)
 *
 * Auth TỰ VIẾT (packages/core/auth.ts) — KHÔNG dùng GoTrue.
 * Chỉ dùng Supabase client cho Realtime + Storage.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* ─── Env vars (từ .env.onpremise hoặc .env.local) ─── */
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] || 'http://localhost:54325';
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || 'local-anon-key-2026';
const SUPABASE_REALTIME_URL = process.env['NEXT_PUBLIC_SUPABASE_REALTIME_URL'] || 'ws://localhost:54324';

let _client: SupabaseClient | null = null;

/**
 * Lấy Supabase client (singleton).
 * Chỉ dùng cho Realtime + Storage. Auth tự viết.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    // Supabase v2: realtime URL được suy từ SUPABASE_URL.
    // On-premise: SUPABASE_URL = storage API URL, nhưng realtime chạy port khác.
    // Cách đơn giản: truyền SUPABASE_URL làm base, realtime sẽ dùng cùng host.
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Tắt auth built-in (dùng auth tự viết)
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'x-supabase-onpremise': 'true',
        },
      },
    });
  }
  return _client;
}

/* ─── Storage bucket name ─── */
export const STORAGE_BUCKET = 'temp_chat_imgs';

/**
 * Upload ảnh chat vào Storage (on-premise).
 * @param fileName - tên file (vd: chat_xxx.png)
 * @param base64Data - base64 string (không có prefix data:)
 * @returns public URL hoặc null
 */
export async function uploadChatImage(
  fileName: string,
  base64Data: string,
): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      console.error('[STORAGE] Upload failed:', error.message);
      return null;
    }

    // Trả về URL tải về (dùng API route /chat/file/:id)
    return `/chat/file/${data.path}`;
  } catch (err) {
    console.error('[STORAGE] Upload error:', err);
    return null;
  }
}

/**
 * Download ảnh chat từ Storage.
 * @param filePath - đường dẫn trong bucket
 * @returns Buffer hoặc null
 */
export async function downloadChatImage(filePath: string): Promise<Buffer | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .download(filePath);

    if (error || !data) {
      console.error('[STORAGE] Download failed:', error?.message);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('[STORAGE] Download error:', err);
    return null;
  }
}
