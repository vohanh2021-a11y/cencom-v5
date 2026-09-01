'use client';

import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, useApi, type RpcResult } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

/* ════════════════════════════════════════════════════════════════════════
 * W2.6 — TRANG MUA SẮM (/kho/dm): danh sách Đề nghị mua (DM) + duyệt/từ chối.
 *
 * RPC dùng theo TÊN fn (contract W2a đã chốt + envelope lồng):
 *   ✓ dmList({trang_thai?, from?, to?, page?, limit?}) → core trả
 *     {ok, result:[{id,ma,trang_thai,tong,ngay_tao,so_dong,sc_id}], total, page, limit}
 *     LƯU Ý: lỗi input trả {ok:false, error} VỚI HTTP 200 (KHÔNG bắt 400).
 *   ✓ dmDetail({id}) → {ok, dm:{...}, items:[{id,vattu_id,ten,don_vi,so_luong,don_gia}]}
 *   ✓ dmListBySc({sc_id}) → {ok, result:[...]}
 *   ✓ dmDelete({id}) — soft-delete khi 'cho_duyet' & chưa có phiếu nhập.
 *   ⚠ dmDecide/dmFromSC/dmAutoBu THUỘC W2b (worker-c đăng ký song song).
 *     UI gọi theo TÊN; fn chưa khả dụng → RPC trả HTTP 404 'Unknown fn: …'.
 *     Bắt tín hiệu đó để render graceful + nút 'Thử lại' (re-probe). KHÔNG
 *     giả định fn luôn có; KHÔNG tự sửa backend.
 *     CẬP NHẬT: W2b ĐÃ nối `dmDecide(api, { id, quyet:'duyet'|'tu_choi', ly_do })`
 *     qua rpc.ts META ['kho','xem'] + PHÁN QUYẾT thật ở core: chỉ
 *     admin/giamdoc ('mua','duy') hoặc ketoan trong ngưỡng `duyet_mua_nguong`
 *     — kho/xuong bấm sẽ nhận {ok:false,'…cần Giám đốc…'} (UI hiển thị banner,
 *     KHÔNG tự nới quyền ở client).
 *
 * vì /api/rpc bọc {ok:true, result:<giá trị core return>} → client PHẢI bóc
 * LỚP THỨ HAI (`unwrap`) cho các fn trả envelope nội bộ (dmList/dmDetail/…).
 * ════════════════════════════════════════════════════════════════════════ */

interface DmRow {
  id: string;
  ma: string;
  trang_thai: string;
  tong: number;
  ngay_tao?: string | null;
  so_dong: number;
  sc_id?: string | null;
}

interface DmItem {
  id: string;
  vattu_id: string;
  ten?: string | null;
  don_vi?: string | null;
  so_luong: number;
  don_gia: number;
}

interface DmDetail {
  id: string;
  ma: string;
  sc_id?: string | null;
  trang_thai: string;
  tong: number;
  nguoi_tao?: string | null;
  ngay_tao?: string | null;
}

type Tab = 'danh_sach' | 'tu_sc';
type TrangThaiFilter = '' | 'cho_duyet' | 'da_nhap' | 'tu_choi';

const TT_LABEL: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_nhap: 'Đã nhập',
  tu_choi: 'Từ chối',
  da_duyet: 'Đã duyệt',
};

const TT_CHIP: Record<string, string> = {
  cho_duyet: 'bg-amber-100 text-amber-800',
  da_nhap: 'bg-green-100 text-green-800',
  tu_choi: 'bg-red-100 text-red-800',
};

const PAGE_SIZE = 25;

const money = (n?: number | string | null) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('vi-VN') + '₫';
const fmtDate = (ts?: string | null) => (!ts ? '—' : String(ts).slice(0, 10));

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

function TtChip({ tt }: { tt: string }) {
  return (
    <span
      data-testid="dm-tt"
      className={
        'inline-flex rounded px-2 py-0.5 text-xs font-medium ' +
        (TT_CHIP[tt] ?? 'bg-slate-100 text-slate-700')
      }
    >
      {TT_LABEL[tt] ?? tt}
    </span>
  );
}

/** Chữ ký lỗi để phân biệt "fn chưa khả dụng" (W2b) với lỗi khác. */
function isFnUnavailable(res: RpcResult): boolean {
  if (res.ok) return false; // thành công RPC → fn có tồn tại
  if (res.status === 404) return true; // dispatch throw 'Unknown fn' → HTTP 404
  const e = (res.error || '').toLowerCase();
  return e.includes('unknown fn') || e.includes('fn chưa khả dụng');
}

export default function KhoDmPage() {
  const router = useRouter();
  const api = useApi();
  const [user, setUser] = useState<Actor | null | undefined>(undefined);

  const [tab, setTab] = useState<Tab>('danh_sach');

  // ── dmList (tab Danh sách) ──────────────────────────────────────────────
  const [rows, setRows] = useState<DmRow[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrangThaiFilter>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ── dmListBySc (tab DM từ SC) ───────────────────────────────────────────
  const [scId, setScId] = useState('');
  const [scRows, setScRows] = useState<DmRow[] | null>(null);
  const [scLoading, setScLoading] = useState(false);
  const [scError, setScError] = useState<string | null>(null);

  // ── expand row → dmDetail ────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ dm: DmDetail | null; items: DmItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── fn availability probe cho dmDecide (W2b) ─────────────────────────────
  // null = chưa probe · true = đã đăng ký (gọi được) · false = 'Unknown fn'.
  const [decideAvailable, setDecideAvailable] = useState<boolean | null>(null);
  const [probing, setProbing] = useState(false);

  // ── modal quyết định (Duyệt / Từ chối) ───────────────────────────────────
  const [decideModal, setDecideModal] = useState<{ id: string; action: 'duyet' | 'tu_choi' } | null>(null);
  const [lyDo, setLyDo] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  /* ─────────────────────────── helpers RPC ─────────────────────────── */
  // Bóc envelope lớp 2: /api/rpc luôn {ok:true,result:<core>}; core dmList/
  // dmDetail tự trả {ok:false,error} cho lỗi input (HTTP 200).
  const unwrap = (res: RpcResult) => {
    if (!res.ok) return { ok: false as const, error: res.error, status: res.status };
    const env = (res as { result: any }).result;
    if (env && typeof env === 'object' && env.ok === false) {
      return { ok: false as const, error: env.error || 'Lỗi nghiệp vụ', status: 200 };
    }
    return { ok: true as const, env };
  };

  // ─────────────── availability probe ───────────────
  const probeDecide = useCallback(async () => {
    setProbing(true);
    // Gọi {} — fn chưa đăng ký → dispatch throw 'Unknown fn' → HTTP 404.
    // fn ĐÃ đăng ký → core validate id → {ok:false,'thiếu id…'} (HTTP 200)
    // hoặc {ok:true} — trong MỌI trường hợp không phải 404 → available=true.
    const r = await api.call('dmDecide', {});
    setDecideAvailable(isFnUnavailable(r) ? false : true);
    setProbing(false);
  }, [api]);

  // ─────────────── dmList loader ───────────────
  const loadList = useCallback(
    async (p: number) => {
      setListLoading(true);
      setListError(null);
      setRows(null);
      const r = await api.call('dmList', { trang_thai: filter || undefined, page: p, limit: PAGE_SIZE });
      const u = unwrap(r);
      if (!u.ok) {
        // lỗi input (vd trang_thai lạ) → envelope {ok:false} HTTP 200 — render banner, KHÔNG crash
        setListError(u.error);
        setRows([]);
      } else {
        setRows((u.env.result as DmRow[]) ?? []);
        setTotal(Number(u.env.total ?? 0));
      }
      setListLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, filter]
  );

  // ─────────────── dmDetail loader ───────────────
  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      setDetail(null);
      const r = await api.call('dmDetail', { id });
      const u = unwrap(r);
      if (!u.ok) {
        setDetailError(u.error);
      } else {
        setDetail({ dm: (u.env.dm as DmDetail) ?? null, items: (u.env.items as DmItem[]) ?? [] });
      }
      setDetailLoading(false);
    },
    [api]
  );

  // ─────────────── dmListBySc loader ───────────────
  const loadBySc = useCallback(async () => {
    const s = scId.trim();
    if (!s) {
      setScError('Nhập mã SC (ví dụ SC-000001).');
      setScRows([]);
      return;
    }
    setScLoading(true);
    setScError(null);
    setScRows(null);
    const r = await api.call('dmListBySc', { sc_id: s });
    const u = unwrap(r);
    if (!u.ok) {
      setScError(u.error);
      setScRows([]);
    } else {
      setScRows((u.env.result as DmRow[]) ?? []);
    }
    setScLoading(false);
  }, [api, scId]);

  /* ─────────────────────────── effects ─────────────────────────── */
  useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      setUser(u);
      if (!u) {
        router.replace('/login');
        return;
      }
      probeDecide();
    });
    return () => {
      active = false;
    };
  }, [router, probeDecide]);

  useEffect(() => {
    if (tab !== 'danh_sach') return;
    setPage(1);
    loadList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter]);

  const role = user?.role;
  const canView = !!role && role !== 'ketoan'; // dmList ['kho','xem'] — ketoan không mua sắm
  const canDelete = role === 'kho' || role === 'admin'; // dmDelete ['kho','sua']
  // canDecide CHỈ là hint UI: PHÁN QUYẾT thật nằm trong core dmDecide (W2b) —
  // admin/giamdoc ('mua','duy') hoặc ketoan trong ngưỡng duyet_mua_nguong.
  // kho/xuong KHÔNG có mua.duy → ẩn nút (nhấn qua UI custom vẫn bị core chặn).
  const canDecide = role === 'admin' || role === 'giamdoc';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currentRows = tab === 'danh_sach' ? rows : scRows;
  const rowsLoading = tab === 'danh_sach' ? listLoading : scLoading;
  const listErr = tab === 'danh_sach' ? listError : scError;

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      setDetailError(null);
    } else {
      setExpandedId(id);
      loadDetail(id);
    }
  };

  const openDecide = (id: string, action: 'duyet' | 'tu_choi') => {
    setLyDo('');
    setDecideModal({ id, action });
  };

  const submitDecide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decideModal) return;
    setBusy(true);
    setBanner(null);
    const r = await api.call('dmDecide', {
      id: decideModal.id,
      // Chữ ký THẬT của W2b (lib/core/kho.ts dmDecide): p.quyet — KHÔNG phải 'action'.
      quyet: decideModal.action,
      ly_do: decideModal.action === 'tu_choi' ? lyDo.trim() : lyDo.trim() || undefined,
    });
    // fn availability: 404/'Unknown fn' → graceful + re-probe state
    if (isFnUnavailable(r)) {
      setDecideAvailable(false);
      setBanner('dmDecide chưa khả dụng (W2b đang đăng ký). Bấm "Thử lại" sau khi backend nối xong.');
      setBusy(false);
      return;
    }
    const u = unwrap(r);
    if (!u.ok) {
      // lỗi thật (quyền/ngưỡng/trạng thái) — hiển thị, giữ modal để sửa
      setBanner(u.error || 'Không duyệt được đề nghị.');
    } else {
      setDecideModal(null);
      setLyDo('');
      await loadList(page);
      if (expandedId === decideModal.id) loadDetail(decideModal.id);
    }
    setBusy(false);
  };

  const doDelete = async (id: string) => {
    if (!window.confirm(`Xóa đề nghị mua ${id}? (chỉ khi chờ duyệt & chưa nhập kho)`)) return;
    setBusy(true);
    setBanner(null);
    const r = await api.call('dmDelete', { id });
    const u = unwrap(r);
    if (!r.ok || !u.ok) setBanner((!r.ok ? r.error : u.error) || 'Xóa thất bại.');
    else {
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
      }
      await loadList(page);
    }
    setBusy(false);
  };

  if (user === undefined || user === null) return <Spinner />;

  return (
    <div className="min-h-[50vh]">
      {busy && <Spinner />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Mua sắm — Đề nghị mua</h1>
        <div className="flex items-center gap-2">
          <span
            data-testid="dm-decide-avail"
            className={
              'rounded px-2 py-1 text-xs font-medium ' +
              (decideAvailable === true
                ? 'bg-green-100 text-green-800'
                : decideAvailable === false
                  ? 'bg-red-100 text-red-800'
                  : 'bg-slate-100 text-slate-600')
            }
          >
            {probing
              ? 'đang kiểm tra dmDecide…'
              : decideAvailable === true
                ? 'dmDecide: sẵn sàng'
                : decideAvailable === false
                  ? 'dmDecide: chưa khả dụng (W2b)'
                  : 'dmDecide: ?'}
          </span>
          <button
            type="button"
            data-testid="dm-reprobe"
            onClick={() => probeDecide()}
            disabled={probing}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={() => (tab === 'danh_sach' ? loadList(page) : loadBySc())}
            disabled={rowsLoading}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Làm mới
          </button>
        </div>
      </div>

      {!canView && (
        <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Bạn không có quyền xem đề nghị mua (cần quyền kho:xem).
        </div>
      )}

      {banner && (
        <div
          data-testid="dm-banner"
          className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {banner}
        </div>
      )}

      {/* Tab header */}
      <div
        data-testid="dm-tabs"
        className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1"
      >
        {(
          [
            ['danh_sach', 'Danh sách'],
            ['tu_sc', 'DM từ SC'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            data-testid={`dm-tab-${t}`}
            onClick={() => setTab(t)}
            className={
              'whitespace-nowrap rounded px-4 py-2 text-sm font-medium ' +
              (tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Thanh lọc theo trạng thái (chỉ danh sách) */}
      {tab === 'danh_sach' && (
        <div data-testid="dm-chips" className="mb-3 flex flex-wrap gap-1 text-sm">
          {(
            [
              ['', 'Tất cả'],
              ['cho_duyet', 'Chờ duyệt'],
              ['da_nhap', 'Đã nhập'],
              ['tu_choi', 'Từ chối'],
            ] as [TrangThaiFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val || 'all'}
              type="button"
              data-testid={`dm-chip-${val || 'tat'}`}
              onClick={() => setFilter(val)}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium ' +
                (filter === val
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Tìm DM theo SC */}
      {tab === 'tu_sc' && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500">Mã SC</label>
            <input
              data-testid="dm-sc-input"
              type="text"
              value={scId}
              onChange={(e) => setScId(e.target.value)}
              placeholder="SC-000001"
              className="mt-1 block w-48 rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            data-testid="dm-sc-find"
            onClick={() => loadBySc()}
            disabled={scLoading}
            className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Tìm DM của SC
          </button>
        </div>
      )}

      {listErr && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{listErr}</div>
      )}

      {/* Bảng DM (dùng cho CẢ HAI tab — cùng shape DmRow) */}
      <section data-testid="dm-list-section">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Mã DM</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">SC</th>
                <th className="px-3 py-2 text-right">Số dòng</th>
                <th className="px-3 py-2 text-right">Tổng</th>
                <th className="px-3 py-2 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!canView ? null : rowsLoading || currentRows === null ? (
                <SkeletonRow cols={7} />
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center text-slate-400">
                    Chưa có đề nghị mua nào.
                  </td>
                </tr>
              ) : (
                currentRows.map((row) => (
                  <DmRowBlock
                    key={row.id + (tab === 'danh_sach' ? filter : 'sc')}
                    row={row}
                    expanded={expandedId === row.id}
                    onToggle={() => toggleExpand(row.id)}
                    detailLoading={detailLoading}
                    detailError={detailError}
                    detail={detail}
                    canDelete={canDelete}
                    canDecide={canDecide}
                    decideAvailable={decideAvailable}
                    onDecide={openDecide}
                    onDelete={doDelete}
                    onShowUnavailable={() =>
                      setBanner('dmDecide chưa khả dụng (W2b). Bấm "Thử lại" ở đầu trang.')
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang (chỉ tab danh sách) */}
        {tab === 'danh_sach' && total > 0 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-600">
            <button
              type="button"
              data-testid="dm-prev"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
            >
              ‹ Trước
            </button>
            <span data-testid="dm-info">
              Trang {page}/{totalPages} · Tổng {total}
            </span>
            <button
              type="button"
              data-testid="dm-next"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
            >
              Sau ›
            </button>
          </div>
        )}
      </section>

      {/* Modal Duyệt / Từ chối */}
      {decideModal && (
        <form
          onSubmit={submitDecide}
          data-testid="dm-decide-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h4 className="mb-1 text-sm font-semibold">
              {decideModal.action === 'duyet' ? 'Duyệt' : 'Từ chối'} đề nghị: {decideModal.id}
            </h4>
            <p className="mb-3 text-xs text-slate-500">
              {decideModal.action === 'duyet'
                ? 'DM sẽ chuyển sang trạng thái đã duyệt/đủ điều kiện nhập (theo ngưỡng duyệt).'
                : 'Vui lòng nhập lý do từ chối.'}
            </p>
            <label className="block text-xs font-medium text-slate-600">
              {decideModal.action === 'tu_choi' ? 'Lý do từ chối *' : 'Ghi chú / lý do (tuỳ chọn)'}
            </label>
            <textarea
              data-testid="dm-decide-lydo"
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              rows={3}
              required={decideModal.action === 'tu_choi'}
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder={decideModal.action === 'tu_choi' ? 'Nhập lý do từ chối…' : 'Ghi chú…'}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecideModal(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                data-testid="dm-decide-submit"
                disabled={busy || api.loading || (decideModal.action === 'tu_choi' && !lyDo.trim())}
                className={
                  'rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ' +
                  (decideModal.action === 'duyet' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')
                }
              >
                {decideModal.action === 'duyet' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/* ─────────────────────────── Row + detail expand ─────────────────────────── */
function DmRowBlock({
  row,
  expanded,
  onToggle,
  detailLoading,
  detailError,
  detail,
  canDelete,
  canDecide,
  decideAvailable,
  onDecide,
  onDelete,
  onShowUnavailable,
}: {
  row: DmRow;
  expanded: boolean;
  onToggle: () => void;
  detailLoading: boolean;
  detailError: string | null;
  detail: { dm: DmDetail | null; items: DmItem[] } | null;
  canDelete: boolean;
  canDecide: boolean;
  decideAvailable: boolean | null;
  onDecide: (id: string, action: 'duyet' | 'tu_choi') => void;
  onDelete: (id: string) => void;
  onShowUnavailable: () => void;
}) {
  const isChoDuyet = row.trang_thai === 'cho_duyet';
  const decideDisabled = !canDecide || !isChoDuyet || decideAvailable === false;

  const tryDecide = (action: 'duyet' | 'tu_choi') => {
    // fn availability gate: nếu đã probe = false → graceful báo, không gọi RPC
    if (decideAvailable === false) {
      onShowUnavailable();
      return;
    }
    onDecide(row.id, action);
  };

  return (
    <>
      <tr data-testid="dm-row" className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-2 font-mono">{row.ma || row.id}</td>
        <td className="px-3 py-2">
          <TtChip tt={row.trang_thai} />
        </td>
        <td className="px-3 py-2 text-slate-500">{fmtDate(row.ngay_tao)}</td>
        <td className="px-3 py-2 font-mono text-slate-500">{row.sc_id || '—'}</td>
        <td className="px-3 py-2 text-right">{row.so_dong}</td>
        <td className="px-3 py-2 text-right">{money(row.tong)}</td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              data-testid="dm-expand"
              onClick={onToggle}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {expanded ? 'Đóng' : 'Chi tiết'}
            </button>
            {isChoDuyet && canDecide && (
              <>
                <button
                  type="button"
                  data-testid="dm-approve"
                  onClick={() => tryDecide('duyet')}
                  disabled={decideDisabled}
                  title={decideAvailable === false ? 'dmDecide chưa khả dụng (W2b)' : undefined}
                  className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  data-testid="dm-reject"
                  onClick={() => tryDecide('tu_choi')}
                  disabled={decideDisabled}
                  title={decideAvailable === false ? 'dmDecide chưa khả dụng (W2b)' : undefined}
                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Từ chối
                </button>
              </>
            )}
            {isChoDuyet && canDelete && (
              <button
                type="button"
                data-testid="dm-delete"
                onClick={() => onDelete(row.id)}
                className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Xóa
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr data-testid="dm-detail-row" className="border-b border-slate-100 bg-slate-50 last:border-0">
          <td colSpan={7} className="px-3 py-2">
            {detailLoading ? (
              <div className="text-sm text-slate-400">Đang tải chi tiết…</div>
            ) : detailError ? (
              <div className="text-sm text-red-600">{detailError}</div>
            ) : detail ? (
              <div>
                {detail.dm && (
                  <div className="mb-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{detail.dm.ma}</span> · người tạo:{' '}
                    {detail.dm.nguoi_tao || '—'} · {fmtDate(detail.dm.ngay_tao)} · tổng {money(detail.dm.tong)}
                  </div>
                )}
                <div data-testid="dm-items-grid" className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {detail.items.length === 0 ? (
                    <div className="text-sm text-slate-400">Không có dòng nào.</div>
                  ) : (
                    detail.items.map((it) => (
                      <div
                        key={it.id}
                        data-testid="dm-item"
                        className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                      >
                        <span className="truncate text-slate-700">
                          {it.ten || it.vattu_id}{' '}
                          <span className="text-slate-400">
                            · {Number(it.so_luong).toLocaleString('vi-VN')} {it.don_vi || ''}
                          </span>
                        </span>
                        <span className="ml-2 whitespace-nowrap text-slate-600">{money(it.don_gia)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Chưa có chi tiết.</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
