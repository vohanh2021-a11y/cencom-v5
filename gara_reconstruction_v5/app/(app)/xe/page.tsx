'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, useApi, type RpcResult } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

interface XeRow {
  id: string;
  bien_so: string;
  chu_xe?: string | null;
  nam_sx?: number | null;
  nguyen_gia?: number | null;
  is_test?: number;
  deleted_at?: string;
}

/**
 * W4.5a · kết quả nhóm `xe` từ globalSearch (lib/core/search.ts:37) —
 * shape {id, bien_so, chu_xe} (KHÔNG có nam_sx/nguyen_gia → merge từ xeList
 * khi id khớp; thiếu thì '—', không bịa số).
 */
interface XeHit {
  id: string;
  bien_so: string;
  chu_xe: string | null;
}

/* ───────────────────────── W4.5a helpers (page-local) ─────────────────
 * WHY page-local: wave W4.4 đang sửa components/** song song — KHÔNG được
 * import/đụng file ngoài 3 trang được giao (rule task). Mirror đúng
 * isFnUnavailable (sc/page.tsx:118, GlobalSearch.tsx:32) — cùng bài toán
 * graceful khi fn chưa trong registry; dedupe sẽ làm ở wave consolidation.
 * ─────────────────────────────────────────────────────────────────────── */

/** 'Unknown fn'/404 → fn chưa vào registry (khác lỗi nghiệp vụ envelope). */
function isFnUnavailable(res: RpcResult): boolean {
  if (res.ok) return false;
  if (res.status === 404) return true;
  const e = String(res.error || '').toLowerCase();
  return e.includes('unknown fn') || e.includes('fn chưa khả dụng');
}

/**
 * Gọi RPC KHÔNG qua useApi (api.call set api.loading → Spinner phủ toàn
 * trang mỗi lần gõ → chặn pointer). Cookies same-origin tự gửi → cùng
 * phiên đăng nhập. Trả đúng shape RpcResult của useApi để tái dùng
 * isFnUnavailable + unwrap 2 tầng.
 */
async function callRpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.ok) {
      return { ok: false, error: data?.error || 'Lỗi server', status: res.status };
    }
    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Lỗi mạng', status: 0 };
  }
}

/**
 * Highlight substring khớp (React text node — escape mặc định,
 * KHÔNG dangerouslySetInnerHTML/innerHTML). Case-insensitive ASCII-afe.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  if (!lower.includes(needle)) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(<span key={k++}>{text.slice(i)}</span>);
      break;
    }
    if (idx > i) parts.push(<span key={k++}>{text.slice(i, idx)}</span>);
    parts.push(
      <mark key={k++} className="rounded bg-yellow-200 px-0.5 text-slate-900">
        {text.slice(idx, idx + term.length)}
      </mark>
    );
    i = idx + term.length;
  }
  return <>{parts}</>;
}

/** Lọc client-side (bắt buộc theo task): bien số/chủ xe chứa term, kd-hoa. */
function clientFilterXe<T extends { bien_so?: string | null; chu_xe?: string | null }>(rows: T[], term: string) {
  const needle = term.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (r) =>
      String(r.bien_so ?? '').toLowerCase().includes(needle) ||
      String(r.chu_xe ?? '').toLowerCase().includes(needle)
  );
}

/** XeRow (không có tên 'hit') → shape XeHit cho fallback lọc client. */
function xeToHit(x: XeRow): XeHit {
  return { id: x.id, bien_so: x.bien_so, chu_xe: x.chu_xe ?? null };
}

function Spinner() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div className="rounded bg-white px-6 py-4 shadow text-slate-700">Đang tải…</div>
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

export default function XePage() {
  const api = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q')?.toLowerCase() || '';
  const [user, setUser] = useState<Actor | null>(null);
  const [xeList, setXeList] = useState<XeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bien_so: '', chu_xe: '', nam_sx: '', nguyen_gia: '' });

  /* ───────────────── W4.5a · tiêu thụ ?q= qua globalSearch ─────────────────
   * Contract search (lib/core/search.ts): envelope 2 tầng
   * /api/rpc → {ok,result:<core>} · core → {ok:true,result:{sc,xe,dm,vattu}}
   * → mảng xe THẬT = res.result.result.xe. q≥2 (Q_MIN) — cụt thì KHÔNG gọi
   * (chặn 400 zod min(2) spam). limit 30 = trần clamp core + zod.
   * Ưu tiên dữ liệu: xeList (controller cũ) KHÔNG đổi; search chỉ định vị
   * id → bảng render từ hits (merge cột rộng từ xeList khi khớp id).
   * Realtime/refetch cũ giữ nguyên (không đụng loadXe/SSE trang khác). */
  const qUrl = searchParams.get('q')?.trim() ?? '';
  const [kw, setKw] = useState(qUrl);
  const [hits, setHits] = useState<XeHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [fnDown, setFnDown] = useState(false);
  // race: response cũ (gõ nhanh) không được đè response mới — pattern
  // GlobalSearch.tsx:85.
  const reqId = useRef(0);
  // xeList qua ref → effect search KHÔNG phụ thuộc mảng (tránh double-call
  // khi loadXe xong sau mount + q có sẵn trên URL).
  const xeListRef = useRef<XeRow[]>([]);
  xeListRef.current = xeList;

  // URL đổi (điều hướng từ GlobalSearch/palette href /xe?q=…) → sync ô tìm.
  useEffect(() => {
    setKw(qUrl);
  }, [qUrl]);

  const term = kw.trim();
  const searchActive = term.length >= 2;

  useEffect(() => {
    if (!searchActive) {
      setHits(null);
      setSearching(false);
      return;
    }
    const t = setTimeout(async () => {
      const my = ++reqId.current;
      setSearching(true);
      const res = await callRpc('globalSearch', { q: term, limit: 30 });
      if (my !== reqId.current) return; // có truy vấn mới hơn
      setSearching(false);
      if (isFnUnavailable(res)) {
        // registry chưa có fn → degrade về lọc client-toàn-list, không crash
        setFnDown(true);
        setHits(clientFilterXe(xeListRef.current, term).map((x) => xeToHit(x)));
        return;
      }
      const env = res.ok ? (res.result as { ok?: boolean; result?: { xe?: XeHit[] } } | undefined) : undefined;
      if (res.ok && env?.ok === true) {
        setFnDown(false);
        setHits(clientFilterXe((env.result?.xe ?? []) as XeHit[], term));
      } else {
        // lỗi nghiệp vụ (vd q bị chặn) → lọc client làm fallback
        setFnDown(false);
        setHits(clientFilterXe(xeListRef.current, term).map((x) => xeToHit(x)));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [term, searchActive]);

  // Merge cột rộng (nam_sx/nguyen_gia) từ xeList theo id — search không trả 2 cột này.
  const searchRows: XeRow[] = useMemo(() => {
    if (hits === null) return [];
    const byId = new Map(xeList.map((x) => [x.id, x]));
    return hits.map((h) => {
      const full = byId.get(h.id);
      return {
        id: h.id,
        bien_so: h.bien_so,
        chu_xe: h.chu_xe ?? full?.chu_xe ?? null,
        nam_sx: full?.nam_sx ?? null,
        nguyen_gia: full?.nguyen_gia ?? null,
      };
    });
  }, [hits, xeList]);

  // Lọc đơn giản theo ?q= (bien_so chứa q, chữ thường): chạy khi pipeline
  // globalSearch KHÔNG hoạt động (q cụt <2 ký tự → searchActive false).
  const filteredXeList = useMemo(
    () => (q ? xeList.filter((x) => String(x.bien_so ?? '').toLowerCase().includes(q)) : xeList),
    [xeList, q]
  );

  const rows = searchActive && hits !== null ? searchRows : filteredXeList;

  const clearSearch = () => {
    setKw('');
    setHits(null);
    setFnDown(false);
    if (qUrl) router.replace('/xe'); // xóa ?q= khỏi URL — palette link không treo
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = kw.trim();
    if (query.length < 2) {
      if (qUrl) router.replace('/xe');
      return;
    }
    router.replace(`/xe?q=${encodeURIComponent(query)}`);
  };

  const loadXe = async () => {
    setLoading(true);
    setErr(null);
    const res = await api.call('xeList');
    if (res.ok) {
      setXeList((res.result as XeRow[]) ?? []);
    } else {
      setErr(res.error || 'Không tải được danh sách xe');
      setXeList([]);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const res = await api.call('xeCreate', {
      bien_so: form.bien_so.trim(),
      chu_xe: form.chu_xe.trim() || undefined,
      nam_sx: form.nam_sx ? Number(form.nam_sx) : undefined,
      nguyen_gia: form.nguyen_gia ? Number(form.nguyen_gia) : undefined,
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ bien_so: '', chu_xe: '', nam_sx: '', nguyen_gia: '' });
      loadXe();
    } else {
      setErr(res.error || 'Thêm xe thất bại');
    }
  };

  useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      setUser(u);
      loadXe();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAdd = user?.role === 'admin' || user?.role === 'xuong';

  return (
    <div className="min-h-[50vh]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Bảng xe</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadXe}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            disabled={api.loading}
          >
            Làm mới
          </button>
          {canAdd && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Thêm xe
            </button>
          )}
        </div>
      </div>

      {/* W4.5a · ô tìm theo từ khóa (tiêu thụ ?q= + globalSearch) */}
      <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="xe-search-bar">
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <input
            type="search"
            role="searchbox"
            aria-label="Tìm theo từ khóa"
            data-testid="xe-q"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Tìm theo từ khóa"
            className="w-64 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            data-testid="xe-search-go"
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Tìm
          </button>
        </form>
        {(kw || qUrl) && (
          <button
            type="button"
            onClick={clearSearch}
            data-testid="xe-search-clear"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            clear
          </button>
        )}
        {searching && (
          <span data-testid="xe-search-busy" className="text-xs text-slate-400">
            đang tìm…
          </span>
        )}
      </div>

      {q && (
        <p data-testid="xe-q-info" className="mb-2 text-xs text-slate-500">
          Kết quả cho: {q}
        </p>
      )}

      {searchActive && hits !== null && (
        <div
          data-testid="xe-search-info"
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
        >
          <span>Tìm “{term}” — {hits.length} kết quả</span>
          {fnDown && <span className="text-amber-700">· globalSearch chưa sẵn sàng — lọc client</span>}
        </div>
      )}

      {err && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
              <th className="px-3 py-2">Biển số</th>
              <th className="px-3 py-2">Chủ xe</th>
              <th className="px-3 py-2">Năm SX</th>
              <th className="px-3 py-2">Nguyên giá</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRow cols={4} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                  {searchActive ? `Không có xe khớp “${term}”.` : 'Chưa có xe.'}
                </td>
              </tr>
            ) : (
              rows.map((x) => (
                <tr key={x.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-mono">
                    <Highlight text={x.bien_so} term={searchActive ? term : ''} />
                  </td>
                  <td className="px-3 py-2">
                    {x.chu_xe ? <Highlight text={String(x.chu_xe)} term={searchActive ? term : ''} /> : '—'}
                  </td>
                  <td className="px-3 py-2">{x.nam_sx ? String(x.nam_sx) : '—'}</td>
                  <td className="px-3 py-2">
                    {x.nguyen_gia ? Number(x.nguyen_gia).toLocaleString('vi-VN') + '₫' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && canAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Thêm xe</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Biển số *</label>
                <input
                  type="text"
                  required
                  value={form.bien_so}
                  onChange={(e) => setForm({ ...form, bien_so: e.target.value })}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Chủ xe</label>
                <input
                  type="text"
                  value={form.chu_xe}
                  onChange={(e) => setForm({ ...form, chu_xe: e.target.value })}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Năm SX</label>
                <input
                  type="number"
                  value={form.nam_sx}
                  onChange={(e) => setForm({ ...form, nam_sx: e.target.value })}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Nguyên giá (₫)</label>
                <input
                  type="number"
                  value={form.nguyen_gia}
                  onChange={(e) => setForm({ ...form, nguyen_gia: e.target.value })}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={api.loading}
                  className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {api.loading ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
