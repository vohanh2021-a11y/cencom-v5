'use client';

import { useEffect, useState, useCallback } from 'react';
import type React from 'react';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';
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
  const [user, setUser] = useState<Actor | null>(null);
  const [xeList, setXeList] = useState<XeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bien_so: '', chu_xe: '', nam_sx: '', nguyen_gia: '' });

  const loadXe = useCallback(async () => {
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
  }, [api]);

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
  }, [loadXe]);

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
            ) : xeList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                  Chưa có xe.
                </td>
              </tr>
            ) : (
              xeList.map((x) => (
                <tr key={x.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-mono">{x.bien_so}</td>
                  <td className="px-3 py-2">{x.chu_xe || '—'}</td>
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
