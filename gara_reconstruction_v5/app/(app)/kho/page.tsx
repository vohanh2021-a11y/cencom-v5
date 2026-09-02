'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, useApi, type RpcResult } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

/* ════════════════════════════════════════════════════════════════════════
 * W1.7 — Trang KHO theo pattern v3.6 (gd3.js renderKho/renderNhapKho/
 * renderXuatKho/ktKhoD: VIEWS vật tư + phiếu nhóm 2 tầng + tồn kho có
 * badge thiếu + thanh lý) nhưng code theo style v5 (Tailwind + RPC
 * {fn,args}).
 *
 * TRẠNG THÁI RPC (cập nhật khi worker-c chốt W1b-reg/W1c):
 *   ✓ phieuList/phieuGet  đã đăng ký (W1a) — meta ['kho','xem']
 *   ✓ tonKho/giaLichSuList ĐÃ đăng ký lib/rpc.ts (W1b-reg). DB chạy thật
 *     còn thiếu migration `vattu.ton_cu_hong`/bảng `thanh_ly` (W1.3) →
 *     SELECT tonKho có thể lỗi 400 → tab Tồn kho tự fallback tính từ
 *     vattuList (cùng công thức low = ton < ton_min, sort thieu ASC) +
 *     chip nguồn trên UI; apply migration xong tự về RPC mode.
 *     TODO(W1.3): DB migration ở phía worker-c — UI không cần sửa gì.
 *   ⚠ thanhLyList ĐÃ có trong core (W1c) nhưng chưa vào FN_LIST rpc.ts →
 *     tab Thanh lý render bảng động khi fn trả dữ liệu, ngược lại placeholder
 *     'đang hoàn thiện (W1c.reg)'. TODO(W1c.reg): placeholder tự tắt khi
 *     'thanhLyList' đăng ký — không cần sửa UI.
 *
 * envelope RPC: /api/rpc trả { ok:true, result: <giá trị handler return> }.
 * phieuList/tonKho tự trả envelope lồng {ok,result,total} từ core → client
 * phải bóc LỚP THỨ HAI ('env'). Các handler cũ (vattuList) trả thẳng mảng.
 * ════════════════════════════════════════════════════════════════════════ */

interface VattuRow {
  id: string;
  ten: string;
  don_vi?: string | null;
  ton?: number | string | null;
  gia?: number | string | null;
  ton_min?: number | string | null;
  ton_cu_hong?: number | string | null;
  is_test?: number;
}

interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
}

type Tab = 'vattu' | 'phieu' | 'tonkho' | 'thanhtly';
type PhieuSub = 'list' | 'nhap' | 'xuat' | 'dm';

type Api = ReturnType<typeof useApi>;

const todayStr = () => new Date().toISOString().slice(0, 10);
const money = (n?: number | string | null) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('vi-VN') + '₫';
const qty = (n?: number | string | null) => Number(n ?? 0).toLocaleString('vi-VN');

/** Kích thước trang dùng chung cho các bảng phân trang của tab kho. */
const PAGE_SIZE = 25;

/**
 * Kênh SSE của trang kho — tên chuỗi PHẢI khớp REALTIME_CHANNELS trong
 * lib/realtime.ts ('vattu_changes','sc_vattu_changes','nhap_xuat_changes').
 * KHÔNG import lib/realtime (hoặc useRealtime) vào client component:
 * nó import 'pg' → transitive vào bundle trình duyệt → Next fail-to-
 * compile 'fs' → 500 TOÀN APP (đã gặp ở W1.7, chạy thử e2e).
 */
const KHO_RT_QUERY = 'vattu_changes,sc_vattu_changes,nhap_xuat_changes';

/* ───────────────────────── W4.5a helpers (page-local) ─────────────────
 * WHY page-local: wave W4.4 đang sửa components/** song song — chỉ được
 * đụng file trang được giao. Mirror isFnUnavailable (sc/page.tsx:118).
 * ─────────────────────────────────────────────────────────────────────── */

/** fn chưa vào registry (404/'Unknown fn') — khác lỗi nghiệp vụ envelope. */
function isFnUnavailable(res: RpcResult): boolean {
  if (res.ok) return false;
  if (res.status === 404) return true;
  const e = String(res.error || '').toLowerCase();
  return e.includes('unknown fn') || e.includes('fn chưa khả dụng');
}

/**
 * RPC KHÔNG qua useApi: api.call bật api.loading → Spinner phủ trang chặn
 * pointer mỗi lần gõ. callRpc dùng riêng cho search (cookie tự gửi — cùng
 * phiên), trả cùng shape RpcResult.
 */
async function callRpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.ok) return { ok: false, error: data?.error || 'Lỗi server', status: res.status };
    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Lỗi mạng', status: 0 };
  }
}

/** Highlight khớp (React text — KHÔNG innerHTML), case-insensitive. */
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

/** Nhóm vattu trong globalSearch result (lib/core/search.ts:41). */
interface VtHit {
  id: string;
  ten: string;
  don_vi: string | null;
  ton: unknown;
  gia: unknown;
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

function LoaiChip({ loai }: { loai: string }) {
  return loai === 'nhap' ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Nhập
    </span>
  ) : loai === 'xuat' ? (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      Xuất
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      {loai || '—'}
    </span>
  );
}

/** Điều hướng trang cũ/tối giản: ‹ Trước | Trang i/n (Tổng X) | Sau › */
function Pager({
  page,
  pages,
  total,
  onPrev,
  onNext,
  idBase,
}: {
  page: number;
  pages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  idBase: string;
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
        ‹ Trước
      </button>
      <span data-testid={`${idBase}-info`} className="whitespace-nowrap">
        Trang {page}/{pages} · Tổng {total}
      </span>
      <button
        type="button"
        data-testid={`${idBase}-next`}
        onClick={onNext}
        disabled={page >= pages}
        className="rounded border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        Sau ›
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * TAB 'Vật tư' — danh mục vật tư: danh sách + tạo (giữ nguyên hành vi
 * tab cũ của trang, chỉ đổi nhãn; modal + realtime refresh toàn trang).
 * ────────────────────────────────────────────────────────────────────── */

function VattuListView({ vattuList, term = '' }: { vattuList: VattuRow[]; term?: string }) {
  // pg numeric về dạng string → ép số tường minh (cố định lỗi so sánh string>number)
  const lowStock = (v: VattuRow) => {
    const m = Number(v.ton_min ?? 0);
    return m > 0 && Number(v.ton ?? 0) <= m;
  };
  // W4.5a: dòng TỪ globalSearch có thể không có ton_min (không thuộc sổ kho
  // hiện tại — vd admin test-data) → badge xám '—', không khẳng định Đủ/Thiếu.
  const tmKnown = (v: VattuRow) => v.ton_min != null && v.ton_min !== '';

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
              const known = tmKnown(v);
              return (
                <tr key={v.id} data-testid="vattu-row" className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-mono">{v.id}</td>
                  <td className="px-3 py-2">
                    <Highlight text={v.ten} term={term} />
                  </td>
                  <td className="px-3 py-2">{v.don_vi || '—'}</td>
                  <td className="px-3 py-2 text-right">{qty(v.ton)}</td>
                  <td className="px-3 py-2 text-right">{known ? qty(v.ton_min) : '—'}</td>
                  <td className="px-3 py-2 text-right">{money(v.gia)}</td>
                  <td className="px-3 py-2 text-center">
                    {!known ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        —
                      </span>
                    ) : flagLow ? (
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
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="vattu-form">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tên *</label>
            <input
              type="text"
              required
              aria-label="Tên vật tư"
              value={form.ten}
              onChange={(e) => setForm({ ...form, ten: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Đơn vị</label>
            <input
              type="text"
              aria-label="Đơn vị"
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
              aria-label="Đơn giá"
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
              aria-label="Tồn tối thiểu"
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

/* ════════════════════════════════════════════════════════════════════════
 * W1.7-C — FORM GIỮ NGUYÊN từ bản trước (NhapTab/XuatTab/DmTab + modal
 * VattuForm ở part A). Nay là TẦNG-2 của tab 'Phiếu nhập/xuất'.
 * KHÔNG đổi contract gọi RPC (nhapKho/xuatKho/dmCreate).
 * Item 2 của spec (chọn 'loại' = cu_hong khi tạo nhập kho): CHƯA làm —
 * schema.sql ràng buộc nhap_xuat.loai CHECK IN ('nhap','xuat') và cột
 * ton_cu_hong chưa tồn tại (W1.3 mới đưa vào) → backend chưa nhận loại
 * khác. TODO(W1.3): thêm select loai khi CHECK nới + ton_cu_hong có.
 * ════════════════════════════════════════════════════════════════════════ */

type VattuList = VattuRow;

interface DmItemRow {
  vattu_id: string;
  so_luong: string;
  don_gia: string;
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
  onSubmit: (data: { vattu_id: string; so_luong: string; don_gia: string; ngay: string; ly_do: string; loai: string }) => Promise<void>;
  onOpenVattu: () => void;
  err: string | null;
}) {
  //W1.7 #2 + CORE W1c: `loai` = 'nhap' (hàng dùng được, cộng ton) | 'cu_hong'
  //(VT cũ/hỏng thu hồi → cộng ton_cu_hong INTEGER, don_gia/ly_do bị core ghi
  //marker 'Thu hồi nội bộ' — schema.sql đã có cột, SELECT whitelist trong
  //nhapKho → UI chọn được ngay).
  const [form, setForm] = useState({ vattu_id: '', so_luong: '', don_gia: '', ngay: todayStr(), ly_do: '', loai: 'nhap' });
  const [msg, setMsg] = useState<string | null>(null);
  const isCuHong = form.loai === 'cu_hong';

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
    if (isCuHong && !Number.isInteger(Number(form.so_luong))) {
      setMsg('Số lượng thu hồi phải là số nguyên (linh kiện rời)');
      return;
    }
    await onSubmit({
      vattu_id: form.vattu_id,
      so_luong: form.so_luong,
      don_gia: isCuHong ? '' : form.don_gia,
      ngay: form.ngay || todayStr(),
      ly_do: isCuHong ? '' : form.ly_do,
      loai: form.loai,
    });
    setMsg(null);
    setForm({ vattu_id: '', so_luong: '', don_gia: '', ngay: todayStr(), ly_do: '', loai: 'nhap' });
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
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Loại phiếu *</label>
          <select
            data-testid="nhap-loai"
            value={form.loai}
            onChange={(e) => setForm({ ...form, loai: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          >
            <option value="nhap">Hàng dùng được (cộng tồn)</option>
            <option value="cu_hong">VT cũ/hỏng — thu hồi (kho hỏng)</option>
          </select>
        </div>
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
            step={isCuHong ? 1 : '0.01'}
            value={form.so_luong}
            onChange={(e) => setForm({ ...form, so_luong: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>
        {!isCuHong && (
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
        )}
        <div className={isCuHong ? '' : 'lg:col-start-1'}>
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
            value={isCuHong ? 'Thu hồi nội bộ (tự động)' : form.ly_do}
            disabled={isCuHong}
            onChange={(e) => setForm({ ...form, ly_do: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="Nhập kho từ..."
          />
        </div>
        <div className="md:col-span-2 lg:col-span-5">
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
            {loading ? 'Đang nhập…' : isCuHong ? 'Nhập kho hỏng' : 'Nhập kho'}
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
  onSubmit: (data: { vattu_id: string; so_luong: string; ly_do: string; loai_xuat: string; thanh_ly: boolean; gia_thanh_ly: string }) => Promise<void>;
  onOpenVattu: () => void;
  err: string | null;
}) {
  //W1c core: loai_xuat 'dung' (trừ ton thường) | 'cu_hong' (xuất/thanh lý từ kho
  //hư hỏng — trừ NGUYÊN TỬ ton_cu_hong, số nguyên). Tick 'Dòng thanh lý' → gửi
  //ly_do ĐÚNG 'Thanh lý' (core so khớp constant để ghi bảng thanh_ly, v3.6
  //phieu_nhap_thanhly).
  const [form, setForm] = useState({ vattu_id: '', so_luong: '', ly_do: '', loai_xuat: 'dung', thanh_ly: false, gia_thanh_ly: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const isCuHong = form.loai_xuat === 'cu_hong';

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
    if (isCuHong && !Number.isInteger(Number(form.so_luong))) {
      setMsg('Số lượng xuất kho hỏng phải là số nguyên (linh kiện rời)');
      return;
    }
    await onSubmit({
      vattu_id: form.vattu_id,
      so_luong: form.so_luong,
      ly_do: form.thanh_ly ? 'Thanh lý' : form.ly_do,
      loai_xuat: form.loai_xuat,
      thanh_ly: form.thanh_ly,
      gia_thanh_ly: form.thanh_ly ? form.gia_thanh_ly : '',
    });
    setMsg(null);
    setForm({ vattu_id: '', so_luong: '', ly_do: '', loai_xuat: 'dung', thanh_ly: false, gia_thanh_ly: '' });
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
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Loại xuất *</label>
          <select
            data-testid="xuat-loai"
            value={form.loai_xuat}
            onChange={(e) => setForm({ ...form, loai_xuat: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          >
            <option value="dung">Dùng được (trừ tồn kho)</option>
            <option value="cu_hong">Hư hỏng / thanh lý (kho hỏng)</option>
          </select>
        </div>
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
                {v.ten} — {isCuHong ? `hỏng: ${qty(v.ton_cu_hong ?? 0)}` : `tồn: ${qty(v.ton)} ${v.don_vi || ''}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Số lượng *</label>
          <input
            type="number"
            min={0}
            step={isCuHong ? 1 : '0.01'}
            value={form.so_luong}
            onChange={(e) => setForm({ ...form, so_luong: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 pt-6 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              data-testid="xuat-thanhly"
              checked={form.thanh_ly}
              onChange={(e) => setForm({ ...form, thanh_ly: e.target.checked })}
              className="h-4 w-4 accent-red-600"
            />
            Dòng thanh lý
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">Lý do</label>
          <input
            type="text"
            value={form.thanh_ly ? 'Thanh lý' : form.ly_do}
            disabled={form.thanh_ly}
            onChange={(e) => setForm({ ...form, ly_do: e.target.value })}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="Sử dụng cho..."
          />
        </div>
        {form.thanh_ly && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Giá thanh lý (₫)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.gia_thanh_ly}
              onChange={(e) => setForm({ ...form, gia_thanh_ly: e.target.value })}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}
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
            className="inline-flex items-center rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Đang xuất…' : 'Xuất kho'}
          </button>
        </div>
      </form>
    </div>
  );
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

/* ════════════════════════════════════════════════════════════════════════
 * W1.7-B — TAB 'PHIẾU NHẬP/XUẤT' (mặc định, 2 tầng): nhóm phiếu dari
 * phieuList (W1a) — hàng đợi group-row, click MỞ rộng tải dòng qua
 * phieuGet (KHÔNG render 2 bảng nhập/xuất rời như bản cũ), chip loại
 * Tất/Nhập/Xuất, lọc from/to, phân trang ‹ Trước · Trang i/n · Sau ›.
 * ════════════════════════════════════════════════════════════════════════ */

interface PhieuRow {
  id: string;
  loai: string;
  ngay: string | null;
  ncc?: string | null;
  ly_do?: string | null;
  sc_id?: string | null;
  so_dong: number;
  tong_tien: number;
}

interface PhieuLine {
  id: string;
  vattu_id: string;
  ten: string;
  don_vi?: string | null;
  so_luong: number | null;
  don_gia: number | null;
  thanh_tien: number;
}

interface PhieuDetail {
  header: {
    id: string;
    loai: string;
    ngay?: string | null;
    ncc?: string | null;
    ly_do?: string | null;
    sc_id?: string | null;
    nguoi?: string | null;
  };
  lines: PhieuLine[];
  so_dong: number;
  tong_tien: number;
}

type DetailState = { loading?: boolean; data?: PhieuDetail; error?: string };

function DetailCell({ st }: { st: DetailState | undefined }) {
  if (!st) return null;
  if (st.loading)
    return <div className="py-1 text-sm text-slate-400">Đang tải chi tiết phiếu…</div>;
  if (!st.data)
    return <div className="py-1 text-sm text-red-600">{st.error || 'Không tải được chi tiết'}</div>;
  const d = st.data;
  return (
    <div data-testid="phieu-lines" className="py-1">
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {d.header.ncc ? <span>NCC: <b className="text-slate-700">{d.header.ncc}</b></span> : null}
        {d.header.ly_do ? <span>Lý do: {d.header.ly_do}</span> : null}
        {d.header.sc_id ? <span>SC: {d.header.sc_id}</span> : null}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left font-semibold text-slate-600">
            <th className="px-2 py-1">Mã dòng</th>
            <th className="px-2 py-1">Vật tư</th>
            <th className="px-2 py-1 text-right">Số lượng</th>
            <th className="px-2 py-1 text-right">Đơn giá</th>
            <th className="px-2 py-1 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((ln) => (
            <tr key={ln.id} data-testid="phieu-line" className="border-b border-slate-100 last:border-0">
              <td className="px-2 py-1 font-mono">{ln.id}</td>
              <td className="px-2 py-1">{ln.ten}</td>
              <td className="px-2 py-1 text-right">
                {qty(ln.so_luong)} {ln.don_vi || ''}
              </td>
              <td className="px-2 py-1 text-right">{money(ln.don_gia)}</td>
              <td className="px-2 py-1 text-right">{money(ln.thanh_tien)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="px-2 pt-1.5 text-right font-medium text-slate-600">
              Tổng cộng ({d.so_dong} dòng):
            </td>
            <td className="px-2 pt-1.5 text-right font-bold text-slate-800" data-testid="phieu-detail-total">
              {money(d.tong_tien)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PhieuListView({ api, refreshKey }: { api: Api; refreshKey: number }) {
  const [loaiFilter, setLoaiFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PhieuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, DetailState>>({});

  const offset = (page - 1) * PAGE_SIZE;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.call('phieuList', {
      loai: loaiFilter || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Không tải được danh sách phiếu');
      setRows([]);
      setTotal(0);
      return;
    }
    // envelope lồng: core trả {ok,result,total} — /api/rpc bọc result ở ngoài
    const env = res.result as { result?: PhieuRow[]; total?: number };
    setRows(Array.isArray(env?.result) ? env.result : []);
    setTotal(Number(env?.total ?? 0));
  }, [api, loaiFilter, from, to, offset, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (id: string) => {
      if (openId === id) {
        setOpenId(null);
      } else {
        setOpenId(id);
        if (detail[id]) return; // cache — mở lại không fetch
        setDetail((d) => ({ ...d, [id]: { loading: true } }));
        const res = await api.call('phieuGet', { id });
        if (!res.ok) {
          setDetail((d) => ({ ...d, [id]: { error: res.error || 'Không tải được chi tiết phiếu' } }));
          return;
        }
        const env = res.result as { result?: PhieuDetail };
        if (env?.result && Array.isArray(env.result.lines)) {
          setDetail((d) => ({ ...d, [id]: { data: env.result } }));
        } else {
          setDetail((d) => ({ ...d, [id]: { error: 'Dữ liệu phiếu không hợp lệ' } }));
        }
      }
    },
    [api, openId, detail]
  );

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(1);
    setOpenId(null);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1" data-testid="phieu-chips">
          {([['', 'Tất'], ['nhap', 'Nhập'], ['xuat', 'Xuất']] as const).map(([v, label]) => (
            <button
              key={v || 'tat'}
              type="button"
              data-testid={`phieu-chip-${v || 'tat'}`}
              onClick={() => applyFilter(() => setLoaiFilter(v))}
              className={
                'rounded px-3 py-1 text-sm font-medium ' +
                (loaiFilter === v
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100')
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-sm text-slate-500">
          Từ
          <input
            type="date"
            data-testid="phieu-from"
            value={from}
            onChange={(e) => applyFilter(() => setFrom(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-slate-500">
          Đến
          <input
            type="date"
            data-testid="phieu-to"
            value={to}
            onChange={(e) => applyFilter(() => setTo(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        {(from || to || loaiFilter) && (
          <button
            type="button"
            data-testid="phieu-clear"
            onClick={() => applyFilter(() => { setLoaiFilter(''); setFrom(''); setTo(''); })}
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="phieu-error"
          className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
              <th className="w-8 px-2 py-2" aria-label="Mở rộng" />
              <th className="px-3 py-2">Mã phiếu</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2 text-right">Dòng</th>
              <th className="px-3 py-2">SC</th>
              <th className="px-3 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody data-testid="phieu-tbody">
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-center text-slate-400">
                  Chưa có phiếu nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const open = openId === r.id;
                return (
                  <FragmentRow
                    key={r.id}
                    row={r}
                    open={open}
                    st={detail[r.id]}
                    onToggle={() => void toggle(r.id)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pager
        idBase="phieu"
        page={page}
        pages={pages}
        total={total}
        onPrev={() => { setOpenId(null); setPage((p) => Math.max(1, p - 1)); }}
        onNext={() => { setOpenId(null); setPage((p) => Math.min(pages, p + 1)); }}
      />
    </div>
  );
}

/** Hàng nhóm phiếu + (khi mở) hàng chi tiết lồng ngay dưới. */
function FragmentRow({
  row,
  open,
  st,
  onToggle,
}: {
  row: PhieuRow;
  open: boolean;
  st: DetailState | undefined;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        data-testid="phieu-row"
        aria-expanded={open}
        onClick={onToggle}
        className={'cursor-pointer border-b border-slate-100 hover:bg-slate-50 last:border-0 ' + (open ? 'bg-slate-50' : '')}
      >
        <td className="px-2 py-2 text-slate-400">{open ? '▾' : '▸'}</td>
        <td className="px-3 py-2 font-mono">{row.id}</td>
        <td className="px-3 py-2"><LoaiChip loai={row.loai} /></td>
        <td className="px-3 py-2">{row.ngay || '—'}</td>
        <td className="px-3 py-2 text-right">{row.so_dong}</td>
        <td className="px-3 py-2 font-mono text-xs">{row.sc_id || '—'}</td>
        <td className="px-3 py-2 text-right">{money(row.tong_tien)}</td>
      </tr>
      {open && (
        <tr data-testid="phieu-detail-row">
          <td colSpan={7} className="bg-slate-50/70 px-4 py-2 align-top">
            <DetailCell st={st} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * W1.7-B — TAB 'TỒN KHO': gọi RPC `tonKho` (W1b-core, chờ W1b-reg).
 *  - Server mode: bảng + phân trang server-side, sort thieu ASC, toggle
 *    low_only → gửi {low_only:true}; footer lowCount/giaTriTonKho.
 *  - Client fallback (tonKho CHƯA đăng ký RPC — W1b-reg): derive từ
 *    vattuList đúng cùng công thức (low = ton < ton_min, thieu = ton −
 *    ton_min, sort thieu ASC) + CHIP nhỏ báo nguồn trên UI.
 * Badge ĐỎ 'Thiếu ton_min' trên dòng low (pattern v3.6 ktKhoD lowArr).
 * ════════════════════════════════════════════════════════════════════════ */

interface TonItem {
  id: string;
  ten: string;
  don_vi: string;
  gia: number;
  ton: number;
  ton_min: number;
  ton_cu_hong: number;
  thieu: number;
  low: boolean;
  gia_tri: number;
}

interface TonData {
  items: TonItem[];
  total: number;
  page: number;
  limit: number;
  giaTriTonKho: number;
  lowCount: number;
}

function TonKhoView({
  api,
  vattuList,
  refreshKey,
}: {
  api: Api;
  vattuList: VattuRow[];
  refreshKey: number;
}) {
  const [page, setPage] = useState(1);
  const [lowOnly, setLowOnly] = useState(false);
  const [rpc, setRpc] = useState<TonData | null>(null);
  const [src, setSrc] = useState<'init' | 'rpc' | 'client'>('init');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.call('tonKho', { page, limit: PAGE_SIZE, low_only: lowOnly });
    setLoading(false);
    const env = res.ok ? (res.result as { ok?: boolean; result?: TonData }) : null;
    if (res.ok && env && env.ok === true && env.result && Array.isArray(env.result.items)) {
      setRpc(env.result);
      setSrc('rpc');
    } else {
      // Unknown fn / lỗi RPC (W1b-reg chưa chạy) → fallback client-side
      setRpc(null);
      setSrc('client');
    }
  }, [api, page, lowOnly, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientView = useMemo(() => {
    const items: TonItem[] = vattuList.map((v) => {
      const ton = Number(v.ton ?? 0);
      const min = Number(v.ton_min ?? 0);
      const gia = Number(v.gia ?? 0);
      return {
        id: v.id,
        ten: v.ten,
        don_vi: v.don_vi ?? '',
        gia,
        ton,
        ton_min: min,
        ton_cu_hong: Number(v.ton_cu_hong ?? 0),
        thieu: ton - min,
        low: ton < min,
        gia_tri: gia * ton,
      };
    });
    // Sort thieu ASC — đồng nhất công thức ORDER BY SQL phía tonKho
    items.sort((a, b) => a.thieu - b.thieu || a.ten.localeCompare(b.ten, 'vi'));
    const lowCount = items.filter((i) => i.low).length;
    const giaTriTonKho = items.reduce((s, i) => s + i.gia_tri, 0);
    const filtered = lowOnly ? items.filter((i) => i.low) : items;
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const p = Math.min(page, pages);
    return {
      items: filtered.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE),
      total: filtered.length,
      pages,
      giaTriTonKho,
      lowCount,
    };
  }, [vattuList, lowOnly, page]);

  const view: {
    items: TonItem[];
    total: number;
    pages: number;
    giaTriTonKho: number;
    lowCount: number;
  } =
    src === 'rpc' && rpc
      ? {
          //core W1c expose ton_cu_hong trong items; bản cũ chưa có → 0 an toàn
          items: (rpc.items ?? []).map((it) => ({ ...it, ton_cu_hong: Number(it.ton_cu_hong ?? 0) })),
          total: rpc.total,
          pages: Math.max(1, Math.ceil(rpc.total / PAGE_SIZE)),
          giaTriTonKho: rpc.giaTriTonKho,
          lowCount: rpc.lowCount,
        }
      : clientView;

  return (
    <div>
      <div
        data-testid="tonkho-summary"
        className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
      >
        <span>
          Dòng: <b data-testid="tonkho-rows">{view.items.length}</b>/{qty(view.total)} vật tư
        </span>
        <span>
          Dưới mức tồn:{' '}
          <b data-testid="tonkho-lowcount" className={view.lowCount > 0 ? 'text-red-600' : 'text-emerald-700'}>
            {view.lowCount}
          </b>
        </span>
        <span>
          Giá trị tồn kho: <b>{money(view.giaTriTonKho)}</b>
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5" data-testid="tonkho-low-only">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-red-600"
          />
          Chỉ hiện thiếu
        </label>
        {src === 'client' && (
          <span
            data-testid="tonkho-fallback-chip"
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            title="RPC tonKho chưa có trong lib/rpc.ts (W1b-reg) — số liệu tính client từ vattuList, cùng công thức ton<ton_min"
          >
            fallback vattuList — chờ tonKho (W1b.reg)
          </span>
        )}
        {src === 'rpc' && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            tonKho RPC
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Đơn vị</th>
              <th className="px-3 py-2 text-right">Tồn</th>
              <th className="px-3 py-2 text-right">Hỏng</th>
              <th className="px-3 py-2 text-right">Tối thiểu</th>
              <th className="px-3 py-2 text-right">Chênh</th>
              <th className="px-3 py-2 text-right">Đơn giá</th>
              <th className="px-3 py-2 text-right">Giá trị</th>
              <th className="px-3 py-2 text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody data-testid="tonkho-tbody">
            {loading && src === 'init' ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
            ) : view.items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-3 text-center text-slate-400">
                  {lowOnly ? 'Không có vật tư nào dưới mức tồn.' : 'Chưa có vật tư trong kho.'}
                </td>
              </tr>
            ) : (
              view.items.map((it) => (
                <tr
                  key={it.id}
                  data-testid="tonkho-row"
                  className={
                    'border-b border-slate-100 last:border-0 ' + (it.low ? 'bg-red-50/50' : '')
                  }
                >
                  <td className="px-3 py-2 font-mono">{it.id}</td>
                  <td className="px-3 py-2">{it.ten}</td>
                  <td className="px-3 py-2">{it.don_vi || '—'}</td>
                  <td className={'px-3 py-2 text-right font-medium ' + (it.low ? 'text-red-700' : '')}>
                    {qty(it.ton)}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-700" title="Tồn kho hỏng (W1c)">
                    {qty(it.ton_cu_hong)}
                  </td>
                  <td className="px-3 py-2 text-right">{qty(it.ton_min)}</td>
                  <td
                    className={
                      'px-3 py-2 text-right ' +
                      (it.thieu < 0 ? 'font-semibold text-red-600' : 'text-slate-400')
                    }
                  >
                    {it.thieu < 0 ? '−' + qty(Math.abs(it.thieu)) : qty(it.thieu)}
                  </td>
                  <td className="px-3 py-2 text-right">{money(it.gia)}</td>
                  <td className="px-3 py-2 text-right">{money(it.gia_tri)}</td>
                  <td className="px-3 py-2 text-center">
                    {it.low ? (
                      <span
                        data-testid="tonkho-low-badge"
                        className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                      >
                        Thiếu ton_min
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Đủ tồn
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        idBase="tonkho"
        page={Math.min(page, view.pages)}
        pages={view.pages}
        total={view.total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(view.pages, p + 1))}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * TAB 'Thanh lý' — TODO(W1c): CORE W1c (thanhLyList) chưa xong. Gọi fn
 * theo TÊN; RPC lỗi/rỗng → placeholder 'đang hoàn thiện (W1c.reg)'.
 * Khi fn sẵn: dữ liệu là mảng dòng bất kỳ → render bảng động theo key.
 * ════════════════════════════════════════════════════════════════════════ */

function ThanhLyView({ api, refreshKey }: { api: Api; refreshKey: number }) {
  const [st, setSt] = useState<{ status: 'loading' | 'pending' | 'ready'; rows: any[]; cols: string[] }>({
    status: 'loading',
    rows: [],
    cols: [],
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await api.call('thanhLyList', { limit: PAGE_SIZE, offset: 0 });
      let rows: any[] | null = null;
      if (res.ok) {
        const env: any = res.result;
        if (Array.isArray(env)) rows = env;
        else if (env && typeof env === 'object' && Array.isArray(env.result)) rows = env.result;
      }
      if (!active) return;
      if (rows) {
        setSt({ status: 'ready', rows, cols: rows.length ? Object.keys(rows[0]) : [] });
      } else {
        setSt({ status: 'pending', rows: [], cols: [] });
      }
    })();
    return () => {
      active = false;
    };
  }, [api, refreshKey]);

  if (st.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-400">
        Đang kiểm tra RPC <code className="font-mono">thanhLyList</code>…
      </div>
    );
  }
  if (st.status === 'pending') {
    return (
      <div
        data-testid="thanhtly-pending"
        className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"
      >
        <div className="text-sm font-semibold text-slate-700">
          Thanh lý — đang hoàn thiện (W1c.reg)
        </div>
        <div className="mx-auto mt-1 max-w-md text-xs text-slate-400">
          RPC <code className="font-mono">thanhLyList</code> chưa đăng ký / chưa trả dữ liệu.
          Bảng thanh lý sẽ tự kích hoạt khi CORE W1c xong — không cần sửa UI.
        </div>
      </div>
    );
  }
  if (st.rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-400">
        Chưa có phiếu thanh lý nào.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
            {st.cols.map((c) => (
              <th key={c} className="px-3 py-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {st.rows.map((r, i) => (
            <tr key={String(r.id ?? i)} data-testid="thanhtly-row" className="border-b border-slate-100 last:border-0">
              {st.cols.map((c) => (
                <td key={c} className="px-3 py-2">{String(r[c] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * TAB TẦNG-1 (pattern v3.6 VIEWS: vattu | phiếu nhập/xuất | tồn kho |
 * thanh lý). Mặc định=open 'phieu' + sub 'list' (2 tầng).
 * Role guard giữ đúng pattern hiện tại của file cũ: inline check
 * user.role ∈ {admin, kho} cho form ghi (canCreate); đọc (list/phiếu/
 * tồn kho) mở cho mọi role có mặt ở trang — enforcement thật là RPC
 * dispatch META ['kho','xem']. Nav(components/nav.tsx) đã ẩn /kho cho
 * role không có quyền (role-ẩn như v3.6).
 * ════════════════════════════════════════════════════════════════════════ */

const TAB_LABEL: Record<Tab, string> = {
  vattu: 'Vật tư',
  phieu: 'Phiếu nhập/xuất',
  tonkho: 'Tồn kho',
  thanhtly: 'Thanh lý',
};

const SUB_LABEL: Record<PhieuSub, string> = {
  list: 'Danh sách phiếu',
  nhap: 'Tạo phiếu nhập',
  xuat: 'Tạo phiếu xuất',
  dm: 'Đề xuất mua (DM)',
};

const GUARD_MSG = 'Chỉ vai trò Kho / Admin mới được nhập/xuất/DM.';

function GuardNote() {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {GUARD_MSG}
    </div>
  );
}

export default function KhoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();

  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  // ?q= từ URL (useSearchParams — đồng bộ pattern xe/page.tsx, dm/page.tsx).
  const qUrl = (searchParams.get('q') ?? '').trim();
  // MẶC ĐỊNH = tab phiếu (2 tầng) theo spec W1.7; sub-list render đầu.
  // W4.5a: đến từ /kho?q=<ten-vật-tư> (href GlobalSearch) → mở thẳng tab Vật tư.
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    qUrl.length >= 2 ? 'vattu' : 'phieu'
  );
  const [phieuSub, setPhieuSub] = useState<PhieuSub>('list');
  const [vattuList, setVattuList] = useState<VattuRow[]>([]);
  const [scList, setScList] = useState<ScRow[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showVattuForm, setShowVattuForm] = useState(false);
  // Bộ đếm reload cho các list con (Phieu/TonKho/ThanhLy nhận refreshKey).
  const [refreshSeq, setRefreshSeq] = useState(0);

  /* ───── W4.5a · ?q= → tab Vật tư + globalSearch.vattu[] (highlight) ─────
   * Contract (search.ts:41): mảng thật = res.result.result.vattu (envelope
   * 2 tầng).limit 30 = clamp core + zod (contracts.ts). Realtime SSE + các
   * tab khác GIỮ NGUYÊN — search chỉ thêm lớp render cho tab 'vattu'. */
  const [kw, setKw] = useState(qUrl);
  const [vtHits, setVtHits] = useState<VtHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [fnDown, setFnDown] = useState(false);
  const searchReq = useRef(0); // race: response cũ không đè response mới
  const vattuListRef = useRef<VattuRow[]>([]);
  vattuListRef.current = vattuList;

  // URL đổi (palette /xe… → /kho?q=…) → sync ô tìm + bật tab vật tư.
  useEffect(() => {
    setKw(qUrl);
    if (qUrl.length >= 2) setActiveTab('vattu');
  }, [qUrl]);

  const term = kw.trim();
  const searchActive = term.length >= 2;

  useEffect(() => {
    if (!searchActive) {
      setVtHits(null);
      setSearching(false);
      return;
    }
    const t = setTimeout(async () => {
      const my = ++searchReq.current;
      setSearching(true);
      const res = await callRpc('globalSearch', { q: term, limit: 30 });
      if (my !== searchReq.current) return;
      setSearching(false);
      const needle = term.toLowerCase();
      const localFallback = (): VtHit[] =>
        vattuListRef.current
          .filter((v) => String(v.ten ?? '').toLowerCase().includes(needle))
          .map((v) => ({ id: v.id, ten: v.ten, don_vi: v.don_vi ?? null, ton: v.ton ?? 0, gia: v.gia ?? 0 }));
      if (isFnUnavailable(res)) {
        // fn chưa registry → degrade lọc client, KHÔNG crash (pattern W2b)
        setFnDown(true);
        setVtHits(localFallback());
        return;
      }
      const env = res.ok ? (res.result as { ok?: boolean; result?: { vattu?: VtHit[] } } | undefined) : undefined;
      if (res.ok && env?.ok === true) {
        setFnDown(false);
        setVtHits(
          (env.result?.vattu ?? []).filter((v) => String(v.ten ?? '').toLowerCase().includes(needle)) // filter client-side (duyệt task)
        );
      } else {
        setFnDown(false);
        setVtHits(localFallback());
      }
    }, 250);
    return () => clearTimeout(t);
  }, [term, searchActive]);

  // Merge id → dòng đủ ton_min (badge Đủ/Thiếu) khi ăn khớp sổ kho hiện tại;
  // id lạ (search thấy, list không — vd test-data admin) → ton_min undefined
  // → VattuListView render badge xám '—' (không khẳng định sai).
  // Lọc theo q (từ URL ?q=, đồng bộ vào ô tìm): ten HOẶC ma (id) chứa chuỗi,
  // case-insensitive — bắt cả mã VT-000012 mà globalSearch (chỉ ten) bỏ sót.
  const vtRows: VattuRow[] = useMemo(() => {
    const needle = term.toLowerCase();
    const matchQ = (v: Pick<VattuRow, 'id' | 'ten'>) =>
      !needle ||
      String(v.ten ?? '').toLowerCase().includes(needle) ||
      String(v.id ?? '').toLowerCase().includes(needle);
    if (vtHits === null) return vattuList.filter(matchQ);
    const byId = new Map(vattuList.map((v) => [v.id, v]));
    return vtHits
      .map((h) => {
        const full = byId.get(h.id);
        if (full) return full;
        return { id: h.id, ten: h.ten, don_vi: h.don_vi, ton: h.ton as VattuRow['ton'], gia: h.gia as VattuRow['gia'] };
      })
      .filter(matchQ);
  }, [vtHits, vattuList, term]);

  const clearSearch = () => {
    setKw('');
    setVtHits(null);
    setFnDown(false);
    if (qUrl) router.replace('/kho');
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = kw.trim();
    if (q.length < 2) {
      if (qUrl) router.replace('/kho');
      return;
    }
    setActiveTab('vattu');
    router.replace(`/kho?q=${encodeURIComponent(q)}`);
  };

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

  const reloadAll = useCallback(() => {
    void loadData();
    setRefreshSeq((s) => s + 1);
  }, [loadData]);

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

  // ── Realtime (SSE): dữ liệu kho đổi (khi DB notify được wire ở các W
  // sau — hiện schema v5 chưa có trigger, kênh im lặng là hành vi chuẩn)
  // → reload debounce 400ms. EventSource tự chứa trong effect (lý do kênh:
  // xem KHO_RT_QUERY). Trang cũ KHÔNG có hook realtime nào — thêm mới,
  // không phá gì cũ.
  const reloadRef = useRef<() => void>(() => {});
  reloadRef.current = reloadAll;
  useEffect(() => {
    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;
    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource(`/api/realtime?channels=${KHO_RT_QUERY}`);
      } catch {
        return;
      }
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'connected') return; // ack mở stream — không reload
          if (!msg?.table) return; // chỉ data-frame mang tên bảng mới kích hoạt
        } catch {
          return;
        }
        // debounce gộp nhiều notification liên tiếp của 1 giao dịch
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => reloadRef.current(), 400);
      };
      es.onerror = () => {
        es?.close();
        if (!closed && attempts < 5) {
          attempts += 1;
          timer = setTimeout(connect, 1000 * 2 ** (attempts - 1));
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (debounce) clearTimeout(debounce);
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  const handleVattuCreate = async (data: { ten: string; don_vi: string; gia: string; ton_min: string }) => {
    const res = await api.call('vattuCreate', {
      ten: data.ten,
      don_vi: data.don_vi || undefined,
      gia: data.gia ? Number(data.gia) : undefined,
      ton_min: data.ton_min ? Number(data.ton_min) : undefined,
    });
    if (res.ok) {
      setShowVattuForm(false);
      reloadAll();
    } else {
      setErr(res.error || 'Thêm vật tư thất bại');
    }
  };

  const handleNhapKho = async (data: { vattu_id: string; so_luong: string; don_gia: string; ngay: string; ly_do: string; loai: string }) => {
    //loai 'cu_hong' = W1c (chỉ gửi khi khác mặc định 'nhap' — handler cũ không
    //biết tham số mới, giữ payload cũ cho đường thường)
    const res = await api.call('nhapKho', {
      vattu_id: data.vattu_id,
      so_luong: Number(data.so_luong),
      don_gia: data.don_gia ? Number(data.don_gia) : undefined,
      ngay: data.ngay || todayStr(),
      ly_do: data.ly_do || undefined,
      loai: data.loai === 'cu_hong' ? 'cu_hong' : undefined,
    });
    if (res.ok) {
      setErr(null);
      reloadAll();
    } else {
      setErr(res.error || 'Nhập kho thất bại');
    }
  };

  const handleXuatKho = async (data: { vattu_id: string; so_luong: string; ly_do: string; loai_xuat: string; thanh_ly: boolean; gia_thanh_ly: string }) => {
    const res = await api.call('xuatKho', {
      vattu_id: data.vattu_id,
      so_luong: Number(data.so_luong),
      ly_do: data.ly_do || undefined,
      loai_xuat: data.loai_xuat === 'cu_hong' ? 'cu_hong' : undefined,
      gia_thanh_ly: data.thanh_ly && data.gia_thanh_ly ? Number(data.gia_thanh_ly) : undefined,
    });
    if (res.ok) {
      setErr(null);
      reloadAll();
    } else {
      setErr(res.error || 'Xuất kho thất bại');
    }
  };

  const handleDmCreate = async (data: { sc_id?: string; items: { vattu_id: string; so_luong: number; don_gia?: number }[]; ngay: string }) => {
    const res = await api.call('dmCreate', data);
    if (res.ok) {
      setErr(null);
      reloadAll();
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
            onClick={reloadAll}
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

      {/* Tabs tầng-1 */}
      <div
        data-testid="kho-tabs"
        className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1"
      >
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`kho-tab-${t}`}
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

      {/* Nội dung tầng-1 */}
      {activeTab === 'vattu' && (
        <div>
          {/* W4.5a · ô tìm từ khóa tiêu thụ ?q= qua globalSearch.vattu[] */}
          <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="kho-search-bar">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <input
                type="search"
                role="searchbox"
                aria-label="Tìm theo từ khóa"
                data-testid="kho-q"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="Tìm theo từ khóa"
                className="w-64 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                data-testid="kho-search-go"
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Tìm
              </button>
            </form>
            {(kw || qUrl) && (
              <button
                type="button"
                onClick={clearSearch}
                data-testid="kho-search-clear"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                clear
              </button>
            )}
            {searching && (
              <span data-testid="kho-search-busy" className="text-xs text-slate-400">
                đang tìm…
              </span>
            )}
            {searchActive && vtHits !== null && (
              <span
                data-testid="kho-result-chip"
                className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
              >
                {vtRows.length} kết quả
                {fnDown && <span className="ml-1 text-amber-700">· lọc client</span>}
              </span>
            )}
          </div>
          {qUrl && (
            <p data-testid="kho-result-for" className="mb-2 text-xs text-slate-500">
              Kết quả cho: {qUrl}
            </p>
          )}
          <VattuListView vattuList={vtRows} term={searchActive ? term : qUrl} />
        </div>
      )}

      {activeTab === 'phieu' && (
        <div>
          {/* Tabs tầng-2 (form nhập/xuất/DM cũ giữ nguyên, chỉ đổi vị trí) */}
          <div
            data-testid="phieu-subtabs"
            className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-1"
          >
            {(Object.keys(SUB_LABEL) as PhieuSub[]).map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`phieu-sub-${s}`}
                onClick={() => setPhieuSub(s)}
                className={
                  'whitespace-nowrap rounded-t border-b-2 px-3 py-1.5 text-sm font-medium ' +
                  (phieuSub === s
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700')
                }
              >
                {SUB_LABEL[s]}
              </button>
            ))}
          </div>

          {phieuSub === 'list' && <PhieuListView api={api} refreshKey={refreshSeq} />}
          {phieuSub === 'nhap' &&
            (canCreate ? (
              <NhapTab
                vattuList={vattuList}
                loading={api.loading}
                onSubmit={handleNhapKho}
                onOpenVattu={() => setShowVattuForm(true)}
                err={err}
              />
            ) : (
              <GuardNote />
            ))}
          {phieuSub === 'xuat' &&
            (canCreate ? (
              <XuatTab
                vattuList={vattuList}
                loading={api.loading}
                onSubmit={handleXuatKho}
                onOpenVattu={() => setShowVattuForm(true)}
                err={err}
              />
            ) : (
              <GuardNote />
            ))}
          {phieuSub === 'dm' &&
            (canCreate ? (
              <DmTab
                vattuList={vattuList}
                scList={scList}
                loading={api.loading}
                onSubmit={handleDmCreate}
                onOpenVattu={() => setShowVattuForm(true)}
                err={err}
              />
            ) : (
              <GuardNote />
            ))}
        </div>
      )}

      {activeTab === 'tonkho' && (
        <TonKhoView api={api} vattuList={vattuList} refreshKey={refreshSeq} />
      )}

      {activeTab === 'thanhtly' && <ThanhLyView api={api} refreshKey={refreshSeq} />}

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
