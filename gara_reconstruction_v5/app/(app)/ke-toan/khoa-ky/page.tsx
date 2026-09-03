'use client';

/**
 * Trang Khóa / Mở kỳ kế toán — port từ draft v4
 * apps/web/app/(app)/ke-toan/khoa-ky/page.tsx (commit 8397979), giữ hành vi:
 *  - Gate ke_toan.xem; thao tác cần nhãn ky (ke_toan.ky — khớp kyClose/kyOpen
 *    trong lib/core/ketoan.ts qua checkLock 'ky').
 *  - Card "Kỳ hiện có": draft dùng khối data demo + TODO RPC kyList CHƯA có ở
 *    cả v4 lẫn v5 → GIỮ NGUYÊN demo + TODO (không tự chế RPC ngoài scope).
 *    Lời gọi ledgerList {loai_ct:'ky_ke_toan', limit:50} giữ như draft (kết quả
 *    chưa dùng — đúng ghi chú "ledgerList trả bút toán, không phải kỳ").
 *  - Modal Khóa kỳ: validate đủ tên kỳ + 2 ngày (server chặn lại bằng regex
 *    YYYY-MM-DD); Modal Mở lại kỳ theo ten_ky.
 * Adapt sang convention v5:
 *  - useRpc/rpc([args]) → useApi().call(fn, argsObj) — kyClose {ten_ky,tu_ngay,
 *    den_ngay}, kyOpen {ten_ky} khớp handler lib/rpc.ts:502-503.
 *  - useToast → banner msg; useSession → getCurrentUser + MATRIX (lib/perm.ts).
 *  - SubNav/KETOAN_NAV/Button/Card (v4) → KeToanNav + Tailwind
 *    (pattern khach-hang/page.tsx).
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';

const KT_TAGS = ['xem', 'tao', 'vat', 'chi', 'ky', 'baocao'];

const TABS = [
  { label: 'Dashboard', href: '/ke-toan/dashboard' },
  { label: 'Nhập kho & VAT', href: '/ke-toan/nhap-vat' },
  { label: 'Công nợ NCC', href: '/ke-toan/cong-no' },
  { label: 'Báo cáo', href: '/ke-toan/bao-cao' },
  { label: 'Khóa/Mở kỳ', href: '/ke-toan/khoa-ky' },
];

function KeToanNav() {
  const pathname = usePathname();
  return (
    <nav
      className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2"
      aria-label="Điều hướng Kế toán"
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              'whitespace-nowrap rounded-t px-3 py-1.5 text-sm font-medium ' +
              (active
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700')
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

const inputCls =
  'mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';
const btnPrimary =
  'inline-flex items-center rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
const btnGhost =
  'inline-flex items-center rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50';

type Ky = {
  id: string;
  ten_ky: string;
  tu_ngay: string;
  den_ngay: string;
  da_dong: boolean;
};

export default function KhoaKyPage() {
  const api = useApi();

  const [tags, setTags] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      setTags(u && (u.role === 'admin' || u.role === 'ketoan') ? KT_TAGS : []);
    });
    return () => {
      active = false;
    };
  }, []);
  const has = (t: string) => !!tags?.includes(t);
  const canXem = has('xem');
  const canKy = has('ky');

  // TODO(v5): thêm RPC kyList (đọc ky_ke_toan trực tiếp) — draft cũng chưa có;
  // khi đó thay khối demo bên dưới bằng `kys`.
  const [kys] = React.useState<Ky[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadKys = React.useCallback(async () => {
    setLoading(true);
    try {
      // ledgerList trả bút toán (l.*, so_ct, loai_ct), không phải kỳ — giữ lời
      // gọi như draft để khớp hành vi; kết quả chưa tiêu dùng (đợi kyList).
      await api.call('ledgerList', { loai_ct: 'ky_ke_toan', limit: 50 });
    } catch {
      /* im lặng như draft */
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadKys();
  }, [loadKys]);

  const [showClose, setShowClose] = React.useState(false);
  const [closeTen, setCloseTen] = React.useState('');
  const [closeTu, setCloseTu] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [closeDen, setCloseDen] = React.useState(() => new Date().toISOString().split('T')[0]);

  const [showOpen, setShowOpen] = React.useState(false);
  const [openTen, setOpenTen] = React.useState('');

  async function saveClose() {
    if (!closeTen || !closeTu || !closeDen) {
      setMsg({ kind: 'err', text: 'Thiếu thông tin' });
      return;
    }
    try {
      const res = await api.call('kyClose', { ten_ky: closeTen, tu_ngay: closeTu, den_ngay: closeDen });
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.error || 'Thất bại' });
        return;
      }
      const env = res.result as { ok: boolean; error?: string } | undefined;
      if (env && 'ok' in env && !env.ok) {
        setMsg({ kind: 'err', text: env.error || 'Thất bại' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Đã khóa kỳ' });
      setShowClose(false);
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Lỗi mạng: ' + (e?.message ?? String(e)) });
    }
  }

  async function saveOpen() {
    if (!openTen) {
      setMsg({ kind: 'err', text: 'Thiếu tên kỳ' });
      return;
    }
    try {
      const res = await api.call('kyOpen', { ten_ky: openTen });
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.error || 'Thất bại' });
        return;
      }
      const env = res.result as { ok: boolean; error?: string } | undefined;
      if (env && 'ok' in env && !env.ok) {
        setMsg({ kind: 'err', text: env.error || 'Thất bại' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Đã mở lại kỳ' });
      setShowOpen(false);
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Lỗi mạng: ' + (e?.message ?? String(e)) });
    }
  }

  if (!canXem) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <KeToanNav />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          {tags === null ? 'Đang tải…' : 'Bạn không có quyền quản lý kỳ kế toán.'}
        </div>
      </div>
    );
  }

  // Danh sách draft hiển thị khi chưa có RPC kyList — giữ nguyên demo + trạng
  // thái suy ra từ `kys` rỗng (kys sẽ thay thế khi backend có kyList).
  const demoKys: Array<Ky> = kys.length
    ? kys
    : [
        { ten_ky: 'T08/2026', id: '', tu_ngay: '2026-08-01', den_ngay: '2026-08-31', da_dong: true },
        { ten_ky: 'T09/2026', id: '', tu_ngay: '2026-09-01', den_ngay: '2026-09-30', da_dong: false },
      ];

  const msgBanner = msg && (
    <div
      data-testid="kt-kk-msg"
      className={
        'mb-3 rounded border px-3 py-2 text-sm ' +
        (msg.kind === 'ok'
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-amber-200 bg-amber-50 text-amber-800')
      }
    >
      {msg.text}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl p-4" data-ws="ketoan">
      <KeToanNav />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Khóa / Mở kỳ kế toán</h1>
        <div className="text-sm text-slate-500">
          Khi khóa kỳ, mọi ghi sổ trong khoảng thời gian đó sẽ bị chặn (ledgerPost trả lỗi).
        </div>
      </div>

      {msgBanner}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-medium text-slate-700">Kỳ hiện có (demo)</h3>
          <div className="space-y-2">
            {demoKys.map((k) => (
              <div
                key={k.ten_ky}
                data-testid={`kt-kk-ky-${k.ten_ky}`}
                className="flex items-center justify-between rounded bg-slate-50 p-3"
              >
                <div>
                  <div className="font-medium text-slate-800">{k.ten_ky}</div>
                  <div className="text-sm text-slate-500">
                    {k.tu_ngay} → {k.den_ngay}
                  </div>
                </div>
                <span
                  className={
                    'rounded px-2 py-1 text-xs ' +
                    (k.da_dong ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')
                  }
                >
                  {k.da_dong ? 'Đã khóa' : 'Mở'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-medium text-slate-700">Thao tác nhanh</h3>
          <div className="space-y-2">
            {canKy && (
              <div className="flex gap-2">
                <button type="button" data-testid="kt-kk-btn-close" onClick={() => { setMsg(null); setShowClose(true); }} disabled={loading} className={btnPrimary}>
                  Khóa kỳ mới
                </button>
                <button type="button" data-testid="kt-kk-btn-open" onClick={() => { setMsg(null); setShowOpen(true); }} disabled={loading} className={btnGhost}>
                  Mở lại kỳ
                </button>
              </div>
            )}
            {!canKy && <div className="text-sm text-slate-500">Cần quyền ke_toan.ky</div>}
          </div>
        </div>
      </div>

      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowClose(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="kt-kk-close-modal">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Khóa kỳ kế toán</h2>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Tên kỳ
                <input
                  data-testid="kt-kk-close-ten"
                  className={inputCls}
                  value={closeTen}
                  onChange={(e) => setCloseTen(e.target.value)}
                  placeholder="VD: T10/2026"
                  maxLength={64}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Từ ngày
                  <input data-testid="kt-kk-close-tu" className={inputCls} type="date" value={closeTu} onChange={(e) => setCloseTu(e.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Đến ngày
                  <input data-testid="kt-kk-close-den" className={inputCls} type="date" value={closeDen} onChange={(e) => setCloseDen(e.target.value)} />
                </label>
              </div>
              <div className="text-sm text-slate-500">
                ⚠️ Sau khi khóa, mọi ghi sổ (ledgerPost, phNhapCreate, quyetToan...) trong khoảng này sẽ bị từ chối.
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowClose(false)} className={btnGhost}>
                Hủy
              </button>
              <button type="button" data-testid="kt-kk-close-confirm" onClick={saveClose} disabled={api.loading} className={btnPrimary}>
                Khóa kỳ
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="kt-kk-open-modal">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Mở lại kỳ kế toán</h2>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Tên kỳ cần mở
                <input
                  data-testid="kt-kk-open-ten"
                  className={inputCls}
                  value={openTen}
                  onChange={(e) => setOpenTen(e.target.value)}
                  placeholder="VD: T08/2026"
                  maxLength={64}
                />
              </label>
              <div className="text-sm text-slate-500">
                Chỉ mở lại kỳ đã khóa trước đó. Ghi sổ trong kỳ sẽ được phép lại.
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowOpen(false)} className={btnGhost}>
                Hủy
              </button>
              <button type="button" data-testid="kt-kk-open-confirm" onClick={saveOpen} disabled={api.loading} className={btnPrimary}>
                Mở lại kỳ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
