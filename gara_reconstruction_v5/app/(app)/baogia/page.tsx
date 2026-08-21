'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, getCurrentUser } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
  ngay_tao: string;
  nguoi_tao?: string | null;
  tong?: number | null;
}

interface BgItem {
  ten: string;
  so_luong: number;
  don_gia: number;
}

interface BaogiaRow {
  id: string;
  sc_id?: string | null;
  ncc?: string | null;
  ngay?: string | null;
  tong?: number | null;
  nguoi_tao?: string | null;
  is_test?: number;
  deleted_at?: string;
}

interface BaogiaDetail {
  baogia: BaogiaRow;
  chitiet: { id: string; baogia_id: string; ten: string; so_luong: number; don_gia: number }[];
}

interface FormState {
  sc_id: string;
  ncc: string;
  ngay: string;
  items: BgItem[];
}

const STEPS = [
  { label: 'Chọn SC', desc: 'Chọn phiếu sửa chữa' },
  { label: 'Tên NCC', desc: 'Nhập tên nhà cung cấp' },
  { label: 'Ngày', desc: 'Chọn ngày lập báo giá' },
  { label: 'Mô tả hàng', desc: 'Thêm mô tả sản phẩm/dịch vụ' },
  { label: 'Số lượng', desc: 'Nhập số lượng' },
  { label: 'Đơn giá', desc: 'Nhập đơn giá' },
  { label: 'Thành tiền', desc: 'Xem thành tiền tự động' },
  { label: 'Lưu', desc: 'Lưu báo giá' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  dang_sua: 'Đang sửa',
  da_hoan: 'Đã hoàn',
  da_quyet: 'Đã quyết toán',
  tu_choi: 'Từ chối',
};

const STATUS_CHIP: Record<string, string> = {
  de_xuat: 'bg-amber-100 text-amber-800',
  dang_sua: 'bg-blue-100 text-blue-800',
  da_hoan: 'bg-green-100 text-green-800',
  da_quyet: 'bg-purple-100 text-purple-800',
  tu_choi: 'bg-red-100 text-red-800',
};

const fmtVnd = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('vi-VN') + '₫';

const fmtDate = (s: string) =>
  !s ? '—' : String(s).slice(0, 10);

function Spinner() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div className="rounded bg-white px-6 py-4 shadow text-slate-700">Đang tải…</div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <nav className="mb-6 flex items-center gap-2 overflow-x-auto pb-2" aria-label="Bước tạo báo giá">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={s.label} className="flex items-center gap-1 whitespace-nowrap">
            <span
              className={
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ' +
                (active
                  ? 'bg-blue-600 text-white'
                  : done
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-600')
              }
              aria-current={active ? 'step' : undefined}
            >
              {i + 1}
            </span>
            <span
              className={
                'hidden sm:inline text-sm font-medium ' +
                (active ? 'text-blue-700' : done ? 'text-green-700' : 'text-slate-500')
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="hidden sm:block w-6 border-t-2 border-slate-200" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function BaogiaPage() {
  const router = useRouter();
  const api = useApi();
  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  const [scList, setScList] = useState<ScRow[]>([]);
  const [loadingSc, setLoadingSc] = useState(true);

  // Wizard state
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    sc_id: '',
    ncc: '',
    ngay: '',
    items: [],
  });
  // scratch item being edited across steps 4-6
  const [scratch, setScratch] = useState<BgItem>({ ten: '', so_luong: 0, don_gia: 0 });
  const [submitting, setSubmitting] = useState(false);

  // Recent list + detail modal
  const [recent, setRecent] = useState<BaogiaRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [detail, setDetail] = useState<BaogiaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadSc = useCallback(async () => {
    setLoadingSc(true);
    const res = await api.call('scList');
    if (res.ok) {
      setScList((res.result as ScRow[]) ?? []);
    } else {
      setScList([]);
    }
    setLoadingSc(false);
  }, [api]);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    const res = await api.call('baogiaList');
    if (res.ok) {
      setRecent((res.result as BaogiaRow[]) ?? []);
    } else {
      setRecent([]);
    }
    setLoadingRecent(false);
  }, [api]);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      if (!u) {
        router.replace('/login');
        return;
      }
      setUser(u);
      if (u.role !== 'ketoan' && u.role !== 'admin' && u.role !== 'giamdoc') {
        router.replace('/');
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Load scList once user is resolved
  useEffect(() => {
    if (user) {
      loadSc();
      loadRecent();
    }
  }, [user, loadSc, loadRecent]);

  // Auto pick today on step 3 arrival
  useEffect(() => {
    if (step === 2 && !form.ngay) {
      const today = new Date().toISOString().slice(0, 10);
      setForm((f) => ({ ...f, ngay: today }));
    }
  }, [step, form.ngay]);

  const resetForm = () => {
    setForm({ sc_id: '', ncc: '', ngay: '', items: [] });
    setScratch({ ten: '', so_luong: 0, don_gia: 0 });
    setStep(0);
  };

  // Step handlers
  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const calcTotal = () =>
    form.items.reduce(
      (s, it) => s + (Number(it.so_luong) || 0) * (Number(it.don_gia) || 0),
      0
    );

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const res = await api.call('baogiaSave', {
        sc_id: form.sc_id || undefined,
        ncc: form.ncc || undefined,
        ngay: form.ngay,
        items: form.items,
      });
      if (res.ok) {
        resetForm();
        setStep(0);
        loadRecent();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (id: string) => {
    setLoadingDetail(true);
    const res = await api.call('baogiaGet', { id });
    if (res.ok) {
      setDetail(res.result as BaogiaDetail);
    }
    setLoadingDetail(false);
  };

  const closeDetail = () => setDetail(null);

  // ===== Render the wizard step content =====
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Chọn phiếu sửa chữa (SC)
            </label>
            {loadingSc ? (
              <div className="text-sm text-slate-500">Đang tải danh sách SC…</div>
            ) : (
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.sc_id}
                onChange={(e) => setForm((f) => ({ ...f, sc_id: e.target.value }))}
                required
              >
                <option value="" disabled>
                  — Chọn SC —
                </option>
                {scList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.xe_id} ({STATUS_LABEL[s.trang_thai] ?? s.trang_thai})
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              onClick={goNext}
              disabled={!form.sc_id || loadingSc}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Tiếp theo
            </button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Tên nhà cung cấp (NCC)
            </label>
            <input
              type="text"
              placeholder="Nhập tên NCC"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.ncc}
              onChange={(e) => setForm((f) => ({ ...f, ncc: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!form.ncc.trim()}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tiếp theo
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Ngày lập báo giá
            </label>
            <input
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.ngay}
              onChange={(e) => setForm((f) => ({ ...f, ngay: e.target.value }))}
              required
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!form.ngay}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tiếp theo
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Mô tả hàng (sản phẩm / dịch vụ)
            </label>
            <input
              type="text"
              placeholder="Nhập mô tả hàng"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={scratch.ten}
              onChange={(e) =>
                setScratch((s) => ({ ...s, ten: e.target.value }))
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!scratch.ten.trim()}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tiếp theo
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Số lượng
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="Số lượng"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={scratch.so_luong === 0 ? '' : scratch.so_luong}
              onChange={(e) =>
                setScratch((s) => ({ ...s, so_luong: Number(e.target.value) || 0 }))
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={scratch.so_luong <= 0}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tiếp theo
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Đơn giá
            </label>
            <input
              type="number"
              min={0}
              step={100}
              placeholder="Đơn giá (₫)"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={scratch.don_gia === 0 ? '' : scratch.don_gia}
              onChange={(e) =>
                setScratch((s) => ({ ...s, don_gia: Number(e.target.value) || 0 }))
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={scratch.don_gia <= 0}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tiếp theo
              </button>
            </div>
          </div>
        );

      case 6: {
        const lineTotal =
          (Number(scratch.so_luong) || 0) * (Number(scratch.don_gia) || 0);
        const canAddMore =
          scratch.ten.trim().length > 0 &&
          (Number(scratch.so_luong) || 0) > 0 &&
          (Number(scratch.don_gia) || 0) > 0;
        return (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-medium text-slate-600">Thành tiền dòng:</span>{' '}
              <span className="font-bold text-slate-900">{fmtVnd(lineTotal)}</span>
            </div>
            {form.items.length > 0 && (
              <button
                type="button"
                onClick={goNext}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Hoàn tất danh sách hàng
              </button>
            )}
            {canAddMore && (
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    items: [...f.items, { ...scratch }],
                  }));
                  setScratch({ ten: '', so_luong: 0, don_gia: 0 });
                  setStep(3);
                }}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                + Thêm hàng khác
              </button>
            )}
            <button
              type="button"
              onClick={goBack}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Quay lại
            </button>
            {form.items.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">
                  Danh sách hàng đã thêm ({form.items.length})
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-2 py-1">Mô tả</th>
                      <th className="px-2 py-1 text-right">SL</th>
                      <th className="px-2 py-1 text-right">Đơn giá</th>
                      <th className="px-2 py-1 text-right">Thành tiền</th>
                      <th className="px-2 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1">{it.ten}</td>
                        <td className="px-2 py-1 text-right">{it.so_luong}</td>
                        <td className="px-2 py-1 text-right">{fmtVnd(it.don_gia)}</td>
                        <td className="px-2 py-1 text-right">
                          {fmtVnd(it.so_luong * it.don_gia)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="text-red-600 hover:underline"
                            aria-label={`Xóa ${it.ten}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold">
                      <td colSpan={3} className="px-2 py-1 text-right">
                        Tổng cộng:
                      </td>
                      <td className="px-2 py-1 text-right">{fmtVnd(calcTotal())}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      }

      case 7:
        return (
          <div className="space-y-4">
            <div className="rounded border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Xác nhận báo giá
              </h3>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-slate-500">SC:</dt>
                <dd className="font-medium">
                  {form.sc_id
                    ? scList.find((s) => s.id === form.sc_id)?.id ?? form.sc_id
                    : '—'}
                </dd>
                <dt className="text-slate-500">Tên NCC:</dt>
                <dd className="font-medium">{form.ncc || '—'}</dd>
                <dt className="text-slate-500">Ngày:</dt>
                <dd className="font-medium">{fmtDate(form.ngay)}</dd>
                <dt className="text-slate-500">Số dòng:</dt>
                <dd className="font-medium">{form.items.length}</dd>
                <dt className="text-slate-500">Tổng cộng:</dt>
                <dd className="font-bold text-blue-700">{fmtVnd(calcTotal())}</dd>
              </dl>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting || api.loading || form.items.length === 0}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Đang lưu…' : 'Lưu báo giá'}
              </button>
            </div>
            {api.error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {api.error}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (user === undefined || user === null) return <Spinner />;

  const allowAccess = user.role === 'ketoan' || user.role === 'admin' || user.role === 'giamdoc';
  if (!allowAccess) return <Spinner />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Báo giá</h1>
      </div>

      {/* ===== Form tạo báo giá ===== */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Tạo báo giá mới</h2>
        <StepIndicator step={step} />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === STEPS.length - 1) {
              void handleSave();
            } else {
              void goNext();
            }
          }}
        >
          {renderStep()}
        </form>
      </section>

      {/* ===== Bảng danh sách recent ===== */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Danh sách báo giá gần đây</h2>
          <button
            type="button"
            onClick={loadRecent}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Làm mới
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Mã BG</th>
                <th className="px-3 py-2">SC</th>
                <th className="px-3 py-2">Tên NCC</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2 text-right">Tổng</th>
                <th className="px-3 py-2 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {loadingRecent ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Đang tải…
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Chưa có báo giá.
                  </td>
                </tr>
              ) : (
                recent.map((bg) => (
                  <tr key={bg.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono">{bg.id}</td>
                    <td className="px-3 py-2">{bg.sc_id ?? '—'}</td>
                    <td className="px-3 py-2">{bg.ncc ?? '—'}</td>
                    <td className="px-3 py-2">{fmtDate(bg.ngay ?? '')}</td>
                    <td className="px-3 py-2 text-right">{fmtVnd(bg.tong ?? 0)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => void openDetail(bg.id)}
                        className="rounded border border-blue-600 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
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

      {/* ===== Modal chi tiết ===== */}
      {detail && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết báo giá"
          onClick={closeDetail}
        >
          <div
            className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDetail}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
              aria-label="Đóng"
            >
              ✕
            </button>
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              Chi tiết báo giá {detail.baogia.id}
            </h3>
            <dl className="mb-4 grid grid-cols-2 gap-1 text-sm">
              <dt className="text-slate-500">SC:</dt>
              <dd className="font-medium">{detail.baogia.sc_id ?? '—'}</dd>
              <dt className="text-slate-500">Tên NCC:</dt>
              <dd className="font-medium">{detail.baogia.ncc ?? '—'}</dd>
              <dt className="text-slate-500">Ngày:</dt>
              <dd className="font-medium">{fmtDate(detail.baogia.ngay ?? '')}</dd>
              <dt className="text-slate-500">Tổng:</dt>
              <dd className="font-bold text-blue-700">{fmtVnd(detail.baogia.tong ?? 0)}</dd>
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Mô tả</th>
                    <th className="px-3 py-2 text-right">Số lượng</th>
                    <th className="px-3 py-2 text-right">Đơn giá</th>
                    <th className="px-3 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.chitiet.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                        Không có dòng hàng.
                      </td>
                    </tr>
                  ) : (
                    detail.chitiet.map((ct, i) => (
                      <tr
                        key={ct.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2">{ct.ten}</td>
                        <td className="px-3 py-2 text-right">{ct.so_luong}</td>
                        <td className="px-3 py-2 text-right">{fmtVnd(ct.don_gia)}</td>
                        <td className="px-3 py-2 text-right">
                          {fmtVnd(Number(ct.so_luong) * Number(ct.don_gia))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loadingDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded bg-white px-6 py-4 shadow text-slate-700">
            Đang tải chi tiết…
          </div>
        </div>
      )}
    </div>
  );
}
