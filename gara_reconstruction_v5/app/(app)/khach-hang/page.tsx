'use client';

/**
 * Trang Khách hàng / NCC (GĐ-4).
 * Port từ draft v4 (apps/web/app/(app)/khach-hang/page.tsx) — giữ hành vi:
 * tìm kiếm ten/sdt/MST, phân trang 50, modal thêm/sửa, xóa mềm có confirm.
 * Adapt sang convention v5:
 *  - useRpc/useToast/Pager cua v4 KHONG ton tai o v5 -> dung useApi
 *    (@/lib/hooks/useApi) + banner msg + Pager page-local (pattern kho/page.tsx)
 *  - args RPC cua v5 la OBJECT (khong phai mảng [..] nhu v4): contract
 *    POST /api/rpc {fn,args} — fn khachHang* se dang ky vao lib/rpc.ts
 *    (ngoai pham vi port nay).
 *  - them nut Xoa trong modal khi dang sua (draft dinh nghia del() nhung JSX
 *    khong lan ding — thieu bang chung van hanh; gi nguyen logic confirm).
 */

import * as React from 'react';
import { useApi, type RpcResult } from '@/lib/hooks/useApi';

interface KhachHangRow {
  id: string;
  ten?: string | null;
  sdt?: string | null;
  dia_chi?: string | null;
  email?: string | null;
  ma_so_thue?: string | null;
  la_ncc?: boolean | null;
  ghi_chu?: string | null;
  deleted_at?: string;
}

interface ListResult {
  result?: KhachHangRow[];
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
}

type EnvResult = { ok: boolean; id?: string; error?: string };

const PAGE_LIMIT = 50;
const FIELDS: Array<{ k: string; label: string; type?: string }> = [
  { k: 'ten', label: 'Tên *' },
  { k: 'sdt', label: 'SDT' },
  { k: 'dia_chi', label: 'Địa chỉ' },
  { k: 'email', label: 'Email' },
  { k: 'ma_so_thue', label: 'Mã số thuế' },
  { k: 'ghi_chu', label: 'Ghi chú' },
];

/** Điều hướng trang gọn: Trước | Trang i/n (Tổng X) | Sau (pattern kho/page.tsx) */
function Pager({
  page, pages, total, onPrev, onNext, idBase,
}: {
  page: number; pages: number; total: number;
  onPrev: () => void; onNext: () => void; idBase: string;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-600">
      <button
        type="button"
        data-testid={`${idBase}-prev`}
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        « Trước
      </button>
      <span data-testid={`${idBase}-info`} className="whitespace-nowrap">
        Trang {page}/{pages} — Tổng {total}
      </span>
      <button
        type="button"
        data-testid={`${idBase}-next`}
        onClick={onNext}
        disabled={page >= pages}
        className="rounded border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        Sau »
      </button>
    </div>
  );
}

export default function KhachHangPage() {
  const api = useApi();
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<KhachHangRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const [show, setShow] = React.useState(false);
  const [f, setF] = React.useState<Record<string, string>>({});
  const [laNcc, setLaNcc] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const res: RpcResult = await api.call('khachHangList', { q, page, limit: PAGE_LIMIT });
    if (!res.ok) { setMsg(res.error || 'Lỗi tải danh sách'); return; }
    const env = res.result as ListResult;
    setRows(env?.result ?? []);
    setTotal(Number(env?.total ?? 0));
    setPages(Number(env?.pages ?? 1));
  }, [api, q, page]);

  // Debounce 300ms cho từ khóa tìm — tránh bão request mỗi lần gõ (chuẩn chịu tải)
  React.useEffect(() => {
    const t = setTimeout(() => { void load(); }, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openAdd() {
    setF({}); setLaNcc(false); setMsg(null); setShow(true);
  }
  function openEdit(r: KhachHangRow) {
    const rec: Record<string, string> = {};
    for (const { k } of FIELDS) rec[k] = (r as any)[k] ?? '';
    setF(rec); setLaNcc(!!r.la_ncc); setMsg(null); setShow(true);
  }

  async function save() {
    if (!f.ten || !f.ten.trim()) { setMsg('Nhập tên'); return; }
    setSaving(true);
    try {
      const res = await api.call('khachHangSave', { ...f, ten: f.ten.trim(), la_ncc: laNcc });
      if (!res.ok) { setMsg(res.error || 'Lỗi'); return; }
      const env = res.result as EnvResult;
      if (env?.ok) { setMsg(null); setShow(false); void load(); }
      else setMsg(env?.error || 'Lỗi');
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Xóa khách hàng?')) return;
    setSaving(true);
    try {
      const res = await api.call('khachHangDel', { id });
      if (!res.ok) { setMsg(res.error || 'Lỗi'); return; }
      const env = res.result as EnvResult;
      if (env?.ok) { setMsg(null); setShow(false); void load(); }
      else setMsg(env?.error || 'Lỗi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Khách hàng</h1>
        <button
          type="button"
          data-testid="kh-btn-add"
          onClick={openAdd}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          ＋ Thêm
        </button>
      </div>

      <input
        data-testid="kh-search"
        className="mb-3 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        placeholder="Tìm tên / SĐT / MST…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
      />

      {msg && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {msg}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Tên</th>
              <th className="px-3 py-2 font-medium">SDT</th>
              <th className="px-3 py-2 font-medium">MST</th>
              <th className="px-3 py-2 font-medium">Địa chỉ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                data-testid={`kh-row-${r.id}`}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => openEdit(r)}
              >
                <td className="px-3 py-2">{r.ten}</td>
                <td className="px-3 py-2">{r.sdt || '—'}</td>
                <td className="px-3 py-2">{r.ma_so_thue || '—'}</td>
                <td className="max-w-[16rem] truncate px-3 py-2">{r.dia_chi || '—'}</td>
              </tr>
            ))}
            {!api.loading && rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Chưa có khách hàng</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager
        idBase="kh-list"
        page={page}
        pages={pages}
        total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="kh-modal"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-800">
              {f.id ? 'Khách hàng' : 'Thêm khách hàng'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(({ k, label }) => (
                <label key={k} className="block text-sm font-medium text-slate-700">
                  {label}
                  <input
                    data-testid={`kh-f-${k}`}
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    value={f[k] || ''}
                    maxLength={500}
                    onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                data-testid="kh-f-la_ncc"
                checked={laNcc}
                onChange={(e) => setLaNcc(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Là nhà cung cấp
            </label>
            {msg && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {msg}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              {f.id && (
                <button
                  type="button"
                  data-testid="kh-btn-del"
                  onClick={() => del(String(f.id))}
                  disabled={saving}
                  className="mr-auto rounded border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  Xóa
                </button>
              )}
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="kh-btn-save"
                onClick={save}
                disabled={saving || api.loading}
                className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
