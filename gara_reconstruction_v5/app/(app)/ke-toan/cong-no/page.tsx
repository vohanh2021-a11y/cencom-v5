'use client';

/**
 * Trang Công nợ NCC (Phải trả) — port từ draft v4
 * apps/web/app/(app)/ke-toan/cong-no/page.tsx (commit 8397979), giữ hành vi:
 *  - Bảng công nợ: mã CN / đối tác / ngày / gốc / đã TT / còn nợ / hạn TT /
 *    tuổi nợ / trạng thái (Đã đóng|Quá hạn|Đang nợ).
 *  - Modal "Thanh toán" (chỉ khi có nhãn chi): validate 0 < số tiền ≤ còn nợ
 *    (+0.005 dung sai như draft) → RPC phieuChiCreate {cong_no_id, so_tien,
 *    ngay} (Nợ 331 / Có 112) → refetch.
 *  - Gate ke_toan.xem — không quyền chỉ hiện SubNav + message.
 * Adapt sang convention v5:
 *  - useRpc([args]) → useApi().call(fn, argsObj); congNoList v5 nhận
 *    {loai, limit} (lib/core/ketoan.ts:247) — trả SELECT * cong_no + tuoi_no,
 *    đúng các trường draft dùng (giữ nguyên).
 *  - useToast → banner msg page-local; refetch → hàm load() gọi lại.
 *  - SubNav/KETOAN_NAV/Button/Card/Modal-scrim (v4) → KeToanNav + Tailwind
 *    (pattern khach-hang/page.tsx); fmtMoney → fmtVnd.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';

const KT_TAGS = ['xem', 'tao', 'vat', 'chi', 'ky', 'baocao'];

const fmtVnd = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('vi-VN') + '₫';

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

type CongNo = {
  id: string;
  doi_tac: string;
  so_tien: number;
  da_tt: number;
  con_no: number;
  han_tt: string;
  tuoi_no: number;
  da_dong: boolean;
  ngay: string;
};

export default function CongNoPage() {
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
  const canChi = has('chi');

  const [rows, setRows] = React.useState<CongNo[]>([]);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [showChi, setShowChi] = React.useState<{ cnId: string; conNo: number } | null>(null);
  const [chiSoTien, setChiSoTien] = React.useState('');
  const [chiNgay, setChiNgay] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await api.call('congNoList', { loai: 'phai_tra', limit: 100 });
    if (res.ok) setRows((res.result as CongNo[]) ?? []);
    else setMsg({ kind: 'err', text: res.error || 'Lỗi tải công nợ' });
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const btnPrimary =
    'inline-flex items-center rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
  const btnGhost =
    'inline-flex items-center rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50';

  if (!canXem) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <KeToanNav />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          {tags === null ? 'Đang tải…' : 'Bạn không có quyền xem công nợ.'}
        </div>
      </div>
    );
  }

  function openChi(cn: CongNo) {
    setMsg(null);
    setShowChi({ cnId: cn.id, conNo: Number(cn.con_no) });
    setChiSoTien(String(cn.con_no));
  }

  async function saveChi() {
    if (!showChi) return;
    const soTien = Number(chiSoTien);
    if (soTien <= 0 || soTien > showChi.conNo + 0.005) {
      setMsg({ kind: 'err', text: 'Số tiền không hợp lệ' });
      return;
    }
    setBusy(true);
    try {
      const res = await api.call('phieuChiCreate', {
        cong_no_id: showChi.cnId,
        so_tien: soTien,
        ngay: chiNgay,
      });
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.error || 'Thất bại' });
        return;
      }
      const env = res.result as { ok: boolean; error?: string } | undefined;
      if (env && 'ok' in env && !env.ok) {
        setMsg({ kind: 'err', text: env.error || 'Thất bại' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Đã thanh toán' });
      setShowChi(null);
      void load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Lỗi mạng: ' + (e?.message ?? String(e)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4" data-ws="ketoan">
      <KeToanNav />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Công nợ NCC (Phải trả)</h1>
        <div className="text-sm text-slate-500">Danh sách công nợ, tuổi nợ, thanh toán (Nợ 331 / Có 112)</div>
      </div>

      {msg && (
        <div
          data-testid="kt-cn-msg"
          className={
            'mb-3 rounded border px-3 py-2 text-sm ' +
            (msg.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800')
          }
        >
          {msg.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Mã CN</th>
                <th className="px-3 py-2 font-medium">Đối tác</th>
                <th className="px-3 py-2 font-medium">Ngày</th>
                <th className="px-3 py-2 text-right font-medium">Số tiền gốc</th>
                <th className="px-3 py-2 text-right font-medium">Đã TT</th>
                <th className="px-3 py-2 text-right font-medium">Còn nợ</th>
                <th className="px-3 py-2 font-medium">Hạn TT</th>
                <th className="px-3 py-2 text-right font-medium">Tuổi (ngày)</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">{canChi ? 'Hành động' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid={`kt-cn-row-${r.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">{r.doi_tac || '—'}</td>
                  <td className="px-3 py-2">{r.ngay}</td>
                  <td className="px-3 py-2 text-right">{fmtVnd(Number(r.so_tien))}</td>
                  <td className="px-3 py-2 text-right">{fmtVnd(Number(r.da_tt))}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-600">{fmtVnd(Number(r.con_no))}</td>
                  <td className="px-3 py-2">{r.han_tt || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(r.tuoi_no) > 0 ? <span className="text-red-600">{r.tuoi_no}</span> : r.tuoi_no}
                  </td>
                  <td className="px-3 py-2">
                    {r.da_dong ? (
                      <span className="text-green-600">Đã đóng</span>
                    ) : Number(r.tuoi_no) > 0 ? (
                      <span className="text-red-600">Quá hạn</span>
                    ) : (
                      <span className="text-blue-600">Đang nợ</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canChi && !r.da_dong && (
                      <button
                        type="button"
                        data-testid={`kt-cn-pay-${r.id}`}
                        onClick={() => openChi(r)}
                        className={btnPrimary}
                      >
                        Thanh toán
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-slate-400">Chưa có công nợ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showChi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowChi(null)}>
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="kt-cn-modal"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-800">Thanh toán công nợ</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Còn nợ
                  <input
                    className="mt-1 block w-full rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm"
                    value={fmtVnd(showChi.conNo)}
                    readOnly
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Số tiền thanh toán
                  <input
                    data-testid="kt-cn-so-tien"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    type="number"
                    step="0.01"
                    min={0}
                    max={showChi.conNo}
                    value={chiSoTien}
                    onChange={(e) => setChiSoTien(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Ngày thanh toán
                  <input
                    data-testid="kt-cn-ngay"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                    type="date"
                    value={chiNgay}
                    onChange={(e) => setChiNgay(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowChi(null)} className={btnGhost}>
                Hủy
              </button>
              <button type="button" data-testid="kt-cn-confirm" onClick={saveChi} disabled={busy || api.loading} className={btnPrimary}>
                {busy ? 'Đang lưu…' : 'Thanh toán'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
