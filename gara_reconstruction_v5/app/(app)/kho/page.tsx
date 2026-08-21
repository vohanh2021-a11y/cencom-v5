'use client';

import { useEffect, useState, useCallback } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

interface VattuRow {
  id: string;
  ten: string;
  don_vi?: string | null;
  ton?: number | null;
  gia?: number | null;
  ton_min?: number | null;
  is_test?: number;
}

interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
}

interface DmItem {
  vattu_id: string;
  so_luong: string;
  don_gia: string;
}

type Tab = 'ton' | 'nhap' | 'xuat' | 'dm';

const todayStr = () => new Date().toISOString().slice(0, 10);
const money = (n?: number | string | null) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('vi-VN') + '₫';

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

const TAB_LABEL: Record<Tab, string> = {
  ton: 'Tồn kho',
  nhap: 'Nhập kho',
  xuat: 'Xuất kho',
  dm: 'Phiếu đề xuất',
};

const TAB_CHIP: Record<Tab, string> = {
  ton: 'bg-slate-100 text-slate-800',
  nhap: 'bg-emerald-100 text-emerald-800',
  xuat: 'bg-red-100 text-red-800',
  dm: 'bg-indigo-100 text-indigo-800',
};

function TonTab({ vattuList }: { vattuList: VattuRow[] }) {
  const lowStock = (v: VattuRow) =>
    v.ton_min != null && v.ton_min > 0 && (v.ton ?? 0) <= v.ton_min;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
            <th className="px-3 py-2">Mã</th>
            <th className="px-3 py-2">Tên</th>
            <th className="px-3 py-2">Đơn vị</th>
            <th className="px-3 py-2 text-right">Tồn</th>
            <th className="px-3 py-2 text-right">Tối thiểu</th>
            <th className="px-3 py-2 text-right">Đơn giá</th>
            <th className="px-3 py-2 text-center">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {vattuList.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-3 text-center text-slate-400">
                Chưa có vật tư.
              </td>
            </tr>
          ) : (
            vattuList.map((v) => {
              const flagLow = lowStock(v);
              return (
                <tr key={v.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-mono">{v.id}</td>
                  <td className="px-3 py-2">{v.ten}</td>
                  <td className="px-3 py-2">{v.don_vi || '—'}</td>
                  <td className="px-3 py-2 text-right">{Number(v.ton ?? 0).toLocaleString('vi-VN')}</td>
                  <td className="px-3 py-2 text-right">{Number(v.ton_min ?? 0).toLocaleString('vi-VN')}</td>
                  <td className="px-3 py-2 text-right">{money(v.gia)}</td>
                  <td className="px-3 py-2 text-center">
                    {flagLow ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Thiếu tồn
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Đủ tồn
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function VattuForm({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { ten: string; don_vi: string; gia: string; ton_min: string }) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState({ ten: '', don_vi: '', gia: '', ton_min: '' });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ ten: '', don_vi: '', gia: '', ton_min: '' });
      setMsg(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.ten.trim()) {
      setMsg('Vui lòng nhập tên vật tư');
      return;
    }
    await onSubmit({
      ten: form.ten.trim(),
      don_vi: form.don_vi,
      gia: form.gia,
      ton_min: form.ton_min,
    });
    setMsg(null);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Thêm vật tư</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tên *</label>
            <input
              type="text"
              required
              value={form.ten}
              onChange={(e) => setForm({ ...form, ten: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Đơn vị</label>
            <input
              type="text"
              value={form.don_vi}
              onChange={(e) => setForm({ ...form, don_vi: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="hộp, cái, lít…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Đơn giá (₫)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.gia}
              onChange={(e) => setForm({ ...form, gia: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Tồn tối thiểu</label>
            <input
              type="number"
              min={0}
              step="1"
              value={form.ton_min}
              onChange={(e) => setForm({ ...form, ton_min: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {msg && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {msg}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NhapTab({
  vattuList,
  loading,
  onSubmit,
  onOpenVattu,
  err,
}: {
  vattuList: VattuList[];
  loading: boolean;
  onSubmit: (data: { vattu_id: string; so_luong: string; don_gia: string; ngay: string; ly_do: string }) => Promise<void>;
  onOpenVattu: () => void;
  err: string | null;
}) {
  const [form, setForm] = useState({ vattu_id: '', so_luong: '', don_gia: '', ngay: todayStr(), ly_do: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.vattu_id) {
      setMsg('Vui lòng chọn vật tư');
      return;
    }
    if (!form.so_luong || Number(form.so_luong) <= 0) {
      setMsg('Vui lòng nhập số lượng hợp lệ');
      return;
    }
    await onSubmit({
      vattu_id: form.vattu_id,
      so_luong: form.so_luong,
      don_gia: form.don_gia,
      ngay: form.ngay || todayStr(),
      ly_do: form.ly_do,
    });
    setMsg(null);
    setForm({ vattu_id: '', so_luong: '', don_gia: '', ngay: todayStr(), ly_do: '' });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Nhập kho</h2>
        <button
          type="button"
          onClick={onOpenVattu}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          + Vật tư
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Vật tư *</label>
          <select
            value={form.vattu_id}
            onChange={(e) => setForm({ ...form, vattu_id: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          >
            <option value="">— chọn vật tư —</option>
            {vattuList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.ten} ({v.don_vi || '—'})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Số lượng *</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.so_luong}
            onChange={(e) => setForm({ ...form, so_luong: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Đơn giá (₫)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.don_gia}
            onChange={(e) => setForm({ ...form, don_gia: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Ngày *</label>
          <input
            type="date"
            value={form.ngay}
            onChange={(e) => setForm({ ...form, ngay: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">Lý do</label>
          <input
            type="text"
            value={form.ly_do}
            onChange={(e) => setForm({ ...form, ly_do: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Nhập kho từ..."
          />
        </div>
        <div className="md:col-span-2 lg:col-span-4">
          {msg && (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {msg}
            </div>
          )}
          {err && (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Đang nhập…' : 'Nhập kho'}
          </button>
        </div>
      </form>
    </div>
  );
}

function XuatTab({
  vattuList,
  loading,
  onSubmit,
  onOpenVattu,
  err,
}: {
  vattuList: VattuList[];
  loading: boolean;
  onSubmit: (data: { vattu_id: string; so_luong: string; ly_do: string }) => Promise<void>;
  onOpenVattu: () => void;
  err: string | null;
}) {
  const [form, setForm] = useState({ vattu_id: '', so_luong: '', ly_do: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.vattu_id) {
      setMsg('Vui lòng chọn vật tư');
      return;
    }
    if (!form.so_luong || Number(form.so_luong) <= 0) {
      setMsg('Vui lòng nhập số lượng hợp lệ');
      return;
    }
    await onSubmit({
      vattu_id: form.vattu_id,
      so_luong: form.so_luong,
      ly_do: form.ly_do,
    });
    setMsg(null);
    setForm({ vattu_id: '', so_luong: '', ly_do: '' });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Xuất kho</h2>
        <button
          type="button"
          onClick={onOpenVattu}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          + Vật tư
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Vật tư *</label>
          <select
            value={form.vattu_id}
            onChange={(e) => setForm({ ...form, vattu_id: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          >
            <option value="">— chọn vật tư —</option>
            {vattuList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.ten} — tồn: {Number(v.ton ?? 0).toLocaleString('vi-VN')} {v.don_vi || ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Số lượng *</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.so_luong}
            onChange={(e) => setForm({ ...form, so_luong: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Lý do</label>
          <input
            type="text"
            value={form.ly_do}
            onChange={(e) => setForm({ ...form, ly_do: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Sử dụng cho..."
          />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          {msg && (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {msg}
            </div>
          )}
          {err && (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Đang xuất…' : 'Xuất kho'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface DmItemRow {
  vattu_id: string;
  so_luong: string;
  don_gia: string;
}

function DmTab({
  vattuList,
  scList,
  loading,
  onSubmit,
  onOpenVattu,
  err,
}: {
  vattuList: VattuRow[];
  scList: ScRow[];
  loading: boolean;
  onSubmit: (data: { sc_id?: string; items: { vattu_id: string; so_luong: number; don_gia?: number }[]; ngay: string }) => Promise<void>;
  onOpenVattu: () => void;
  err: string | null;
}) {
  const [scId, setScId] = useState('');
  const [ngay, setNgay] = useState(todayStr);
  const [items, setItems] = useState<DmItemRow[]>([
    { vattu_id: '', so_luong: '', don_gia: '' },
  ]);
  const [msg, setMsg] = useState<string | null>(null);

  const addItem = () =>
    setItems([...items, { vattu_id: '', so_luong: '', don_gia: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, j) => j !== i));

  const updateItem = (i: number, field: keyof DmItemRow, val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const valid = items.filter((it) => it.vattu_id && it.so_luong && Number(it.so_luong) > 0);
    if (valid.length === 0) {
      setMsg('Vui lòng thêm ít nhất 1 vật tư');
      return;
    }
    const payload = {
      sc_id: scId || undefined,
      items: valid.map((it) => ({
        vattu_id: it.vattu_id,
        so_luong: Number(it.so_luong),
        don_gia: it.don_gia ? Number(it.don_gia) : undefined,
      })),
      ngay: ngay || todayStr(),
    };
    await onSubmit(payload);
    setMsg(null);
    setScId('');
    setNgay(todayStr);
    setItems([{ vattu_id: '', so_luong: '', don_gia: '' }]);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Phiếu đề xuất (DM)</h2>
        <button
          type="button"
          onClick={onOpenVattu}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          + Vật tư
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">SC</label>
            <select
              value={scId}
              onChange={(e) => setScId(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">— Không gán SC —</option>
              {scList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Ngày *</label>
            <input
              type="date"
              value={ngay}
              onChange={(e) => setNgay(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={addItem}
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              + Dòng vật tư
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700">Vật tư *</label>
                <select
                  value={it.vattu_id}
                  onChange={(e) => updateItem(i, 'vattu_id', e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">— chọn —</option>
                  {vattuList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.ten}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Số lượng *</label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={it.so_luong}
                  onChange={(e) => updateItem(i, 'so_luong', e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Đơn giá (₫)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.don_gia}
                  onChange={(e) => updateItem(i, 'don_gia', e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="w-full rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {msg && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {msg}
          </div>
        )}
        {err && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Đang tạo…' : 'Tạo DM'}
          </button>
        </div>
      </form>
    </div>
  );
}

type VattuList = VattuRow;

export default function KhoPage() {
  const router = useRouter();
  const api = useApi();

  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>('ton');
  const [vattuList, setVattuList] = useState<VattuRow[]>([]);
  const [scList, setScList] = useState<ScRow[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showVattuForm, setShowVattuForm] = useState(false);

  const loadVattu = useCallback(async () => {
    const res = await api.call('vattuList');
    if (res.ok) {
      setVattuList((res.result as VattuRow[]) ?? []);
    } else {
      setVattuList([]);
      setErr(res.error || 'Không tải được vật tư');
    }
  }, [api]);

  const loadScList = useCallback(async () => {
    const res = await api.call('scList', { trang_thai: 'da_quyet' });
    if (res.ok) {
      setScList((res.result as ScRow[]) ?? []);
    } else {
      setScList([]);
    }
  }, [api]);

  const loadData = useCallback(async () => {
    setLoadingInit(true);
    setErr(null);
    const [vRes, sRes] = await Promise.allSettled([
      api.call('vattuList'),
      api.call('scList', { trang_thai: 'da_quyet' }),
    ]);
    if (vRes.status === 'fulfilled' && vRes.value.ok) {
      setVattuList((vRes.value.result as VattuRow[]) ?? []);
    } else {
      setVattuList([]);
    }
    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      setScList((sRes.value.result as ScRow[]) ?? []);
    } else {
      setScList([]);
    }
    setLoadingInit(false);
  }, [api]);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      setUser(u);
      if (!u) {
        router.replace('/login');
        return;
      }
      loadData();
    });
    return () => {
      active = false;
    };
  }, [router, loadData]);

  const refreshAll = () => {
    loadData();
  };

  const handleVattuCreate = async (data: { ten: string; don_vi: string; gia: string; ton_min: string }) => {
    const res = await api.call('vattuCreate', {
      ten: data.ten,
      don_vi: data.don_vi || undefined,
      gia: data.gia ? Number(data.gia) : undefined,
      ton_min: data.ton_min ? Number(data.ton_min) : undefined,
    });
    if (res.ok) {
      setShowVattuForm(false);
      loadVattu();
    } else {
      setErr(res.error || 'Thêm vật tư thất bại');
    }
  };

  const handleNhapKho = async (data: { vattu_id: string; so_luong: string; don_gia: string; ngay: string; ly_do: string }) => {
    const res = await api.call('nhapKho', {
      vattu_id: data.vattu_id,
      so_luong: Number(data.so_luong),
      don_gia: data.don_gia ? Number(data.don_gia) : undefined,
      ngay: data.ngay || todayStr(),
      ly_do: data.ly_do || undefined,
    });
    if (res.ok) {
      setErr(null);
      loadVattu();
    } else {
      setErr(res.error || 'Nhập kho thất bại');
    }
  };

  const handleXuatKho = async (data: { vattu_id: string; so_luong: string; ly_do: string }) => {
    const res = await api.call('xuatKho', {
      vattu_id: data.vattu_id,
      so_luong: Number(data.so_luong),
      ly_do: data.ly_do || undefined,
    });
    if (res.ok) {
      setErr(null);
      loadVattu();
    } else {
      setErr(res.error || 'Xuất kho thất bại');
    }
  };

  const handleDmCreate = async (data: { sc_id?: string; items: { vattu_id: string; so_luong: number; don_gia?: number }[]; ngay: string }) => {
    const res = await api.call('dmCreate', data);
    if (res.ok) {
      setErr(null);
      loadVattu();
    } else {
      setErr(res.error || 'Tạo phiếu đề xuất thất bại');
    }
  };

  const canCreate = user?.role === 'admin' || user?.role === 'kho';

  if (user === undefined || user === null) {
    return <Spinner />;
  }

  return (
    <div className="min-h-[50vh]">
      {api.loading || loadingInit ? <Spinner /> : null}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý kho</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshAll}
            disabled={api.loading}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Làm mới
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowVattuForm(true)}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Vật tư
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={
              'whitespace-nowrap rounded px-4 py-2 text-sm font-medium ' +
              (activeTab === t
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100')
            }
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'ton' && (
        <TonTab vattuList={vattuList} />
      )}

      {activeTab === 'nhap' && canCreate && (
        <NhapTab
          vattuList={vattuList}
          loading={api.loading}
          onSubmit={handleNhapKho}
          onOpenVattu={() => setShowVattuForm(true)}
          err={err}
        />
      )}

      {activeTab === 'xuat' && canCreate && (
        <XuatTab
          vattuList={vattuList}
          loading={api.loading}
          onSubmit={handleXuatKho}
          onOpenVattu={() => setShowVattuForm(true)}
          err={err}
        />
      )}

      {activeTab === 'dm' && canCreate && (
        <DmTab
          vattuList={vattuList}
          scList={scList}
          loading={api.loading}
          onSubmit={handleDmCreate}
          onOpenVattu={() => setShowVattuForm(true)}
          err={err}
        />
      )}

      {(!canCreate && (activeTab === 'nhap' || activeTab === 'xuat' || activeTab === 'dm')) && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Chỉ vai trò Kho / Admin mới được nhập/xuất/DM.
        </div>
      )}

      {/* Vattu form modal */}
      <VattuForm
        open={showVattuForm}
        onClose={() => setShowVattuForm(false)}
        onSubmit={handleVattuCreate}
        loading={api.loading}
      />
    </div>
  );
}
