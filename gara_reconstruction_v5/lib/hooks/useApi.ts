import { useState, useCallback, useRef } from 'react';
import type { Actor } from '../types.js';

export type RpcResult = { ok: true; result: any } | { ok: false; error: string; status: number };

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (fn: string, args?: any): Promise<RpcResult> => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn, args }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Lỗi server'); return { ok:false, error: data.error, status: res.status }; }
      return { ok:true, result: data.result };
    } catch (e:any) {
      setError(e.message); return { ok:false, error: e.message, status: 0 };
    } finally { setLoading(false); }
  }, []);

  // Quan trọng: trả về object CỐ ĐỊNH (stable identity) qua useRef để các
  // useCallback phụ thuộc `api` (vd [api, id]) không đổi reference mỗi render,
  // tránh useEffect chạy vô hạn (Maximum update depth exceeded).
  const ref = useRef<{ call: typeof call; loading: boolean; error: string | null } | null>(null);
  if (ref.current === null) {
    ref.current = { call, loading: false, error: null };
  }
  ref.current.loading = loading;
  ref.current.error = error;
  return ref.current;
}

export async function getCurrentUser(): Promise<Actor | null> {
  const res = await fetch('/api/auth', { cache: 'no-store' });
  const data = await res.json();
  return data?.user ?? null;
}
