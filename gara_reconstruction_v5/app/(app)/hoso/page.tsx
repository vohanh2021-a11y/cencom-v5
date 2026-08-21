'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import type { FormEvent } from 'react';

interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
  ngay_tao: string;
  nguoi_tao?: string | null;
}

interface HoSoRow {
  id: string;
  sc_id: string;
  so_chung_tu?: string | null;
  ngay?: string | null;
  ghi_chu?: string | null;
  nguoi_lap?: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const formatDate = (ts: string) => (!ts ? '—' : String(ts).slice(0, 19).replace('T', ' '));

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

export default function HoSoPage() {
  const api = useApi();

  const [scList, setScList] = useState<ScRow[]>([]);
  const [hoSoList, setHoSoList] = useState<HoSoRow[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [form, setForm] = useState({
    sc_id: '',
    so_chung_tu: '',
    ngay: todayStr(),
    ghi_chu: '',
  });
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const [detail, setDetail] = useState<HoSoRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadHoSoList = useCallback(async () => {
    const res = await api.call('hoSoList');
    if (res.ok) setHoSoList((res.result as HoSoRow[]) ?? []);
  }, [api]);

  const loadData = useCallback(async () => {
    setLoadingInit(true);
    setFormMsg(null);
    const [sRes, hRes] = await Promise.allSettled([
      api.call('scList', { trang_thai: 'da_quyet' }),
      api.call('hoSoList'),
    ]);
    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      setScList((sRes.value.result as ScRow[]) ?? []);
    } else {
      setScList([]);
    }
    if (hRes.status === 'fulfilled' && hRes.value.ok) {
      setHoSoList((hRes.value.result as HoSoRow[]) ?? []);
    } else {
      setHoSoList([]);
    }
    setLoadingInit(false);
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    if (!form.sc_id) {
      setFormMsg('Vui lòng chọn SC');
      return;
    }
    const res = await api.call('hoSoSave', {
      sc_id: form.sc_id,
      so_chung_tu: form.so_chung_tu || undefined,
      ngay: form.ngay || undefined,
      ghi_chu: form.ghi_chu || undefined,
    });
    if (res.ok) {
      setFormMsg('Lưu hồ sơ kế toán thành công');
      setForm({ sc_id: '', so_chung_tu: '', ngay: todayStr(), ghi_chu: '' });
      loadHoSoList();
    } else {
      setFormMsg(res.error || 'Lỗi lưu hồ sơ');
    }
  };

  const openDetail = async (sc_id: string) => {
    setLoadingDetail(true);
    setDetail(null);
    const res = await api.call('hoSoGet', { sc_id });
    if (res.ok && res.result) {
      setDetail(res.result as HoSoRow);
    } else {
      setDetail(null);
    }
    setLoadingDetail(false);
  };

  const closeModal = () => setDetail(null);

  return (
    <div className="min-h-[50vh]">
      {api.loading || loadingDetail ? <Spinner /> : null}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Hồ sơ kế toán</h1>
        <button
          type="button"
          onClick={() => loadData()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Làm mới
        </button>
      </div>

      {/* Form lưu hồ sơ */}
      <section className="mb-8">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Lưu hồ sơ</h2>

          <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700">SC (đã quyết toán)</label>
              <select
                value={form.sc_id}
                onChange={(e) => setForm((f) => ({ ...f, sc_id: e.target.value }))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                required
              >
                <option value="">Chọn SC…</option>
                {scList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.xe_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Số chứng từ</label>
              <input
                type="text"
                value={form.so_chung_tu}
                onChange={(e) => setForm((f) => ({ ...f, so_chung_tu: e.target.value }))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                placeholder="Số chứng từ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Ngày</label>
              <input
                type="date"
                value={form.ngay}
                onChange={(e) => setForm((f) => ({ ...f, ngay: e.target.value }))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-slate-700">Ghi chú</label>
              <textarea
                value={form.ghi_chu}
                onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                placeholder="Ghi chú (tùy chọn)"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={!form.sc_id || api.loading}
                className="inline-flex items-center rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {api.loading ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>

            {formMsg && (
              <div
                className={
                  'mt-2 rounded border px-3 py-2 text-sm ' +
                  (formMsg.includes('thành công')
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800')
                }
              >
                {formMsg}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Bảng danh sách hồ sơ gần đây */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Hồ sơ gần đây</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Mã HS</th>
                <th className="px-3 py-2">SC</th>
                <th className="px-3 py-2">Số chứng từ</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loadingInit ? (
                <SkeletonRow cols={5} />
              ) : hoSoList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                    Chưa có hồ sơ.
                  </td>
                </tr>
              ) : (
                hoSoList.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono">{h.id}</td>
                    <td className="px-3 py-2 font-mono">{h.sc_id}</td>
                    <td className="px-3 py-2">{h.so_chung_tu || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(h.ngay ?? '')}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openDetail(h.sc_id)}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal chi tiết hồ sơ */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Chi tiết hồ sơ</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Mã HS</dt>
                <dd className="font-mono">{detail.id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">SC</dt>
                <dd className="font-mono">{detail.sc_id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Số chứng từ</dt>
                <dd>{detail.so_chung_tu || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Ngày</dt>
                <dd>{detail.ngay ? formatDate(detail.ngay) : '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Ghi chú</dt>
                <dd className="whitespace-pre-wrap break-words">{detail.ghi_chu || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Người lập</dt>
                <dd>{detail.nguoi_lap || '—'}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
