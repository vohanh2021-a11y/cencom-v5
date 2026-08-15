'use client';

import * as React from 'react';

/**
 * useRpc — gọi POST /api/rpc { fn, args } từ client (contract chuẩn v4).
 * args có thể là object (cho hàm nhận 1 object) hoặc array (cho hàm đa tham số).
 * Trả về { data, error, loading, refetch }.
 */
export function useRpc<T = any>(fn: string, args: unknown = {}) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn, args }),
      });
      const d = await res.json();
      if (d && d.ok) setData(d.result as T);
      else setError(d?.error || 'Lỗi không xác định');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi mạng');
    } finally {
      setLoading(false);
    }
  }, [fn, JSON.stringify(args)]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, refetch: load };
}

/**
 * rpc — gọi RPC một lần (không tự động), dùng cho mutation (create/approve/...).
 * args: object hoặc array (đa tham số).
 */
export async function rpc<T = any>(
  fn: string,
  args: unknown = {}
): Promise<{ ok: boolean; result?: T; error?: string }> {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args }),
    });
    const d = await res.json();
    if (d && d.ok) return { ok: true, result: d.result as T };
    return { ok: false, error: d?.error || 'Lỗi không xác định' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Lỗi mạng' };
  }
}
