'use client';

/**
 * Trang Báo cáo Kế toán — port từ draft v4
 * apps/web/app/(app)/ke-toan/bao-cao/page.tsx (commit 8397979), giữ hành vi:
 *  - Chọn kỳ Từ/Đến (mặc định đầu tháng → hôm nay), tự tải báo cáo khi đổi kỳ
 *    và khi mount, nút "Tải lại".
 *  - Block trống trước khi có dữ liệu: hướng dẫn "Chọn kỳ và nhấn Xem báo cáo".
 *  - 2 card tổng tài sản / tổng nguồn vốn; bảng I CĐKT (cdkt), II chi phí
 *    (KQHĐKD), 3 sổ 152/331/133 (slice 20 dòng, cuộn trong khung).
 *  - Gate ke_toan.xem; nút Xuất chỉ hiện khi có nhãn baocao (checkLock 'baocao'
 *    phía ledgerReport core cũng enforce lại).
 * Adapt sang convention v5:
 *  - useRpc/rpc([args]) → useApi().call('ledgerReport', {tu_ngay, den_ngay})
 *    — args OBJECT theo dispatch lib/rpc.ts W6-reg.
 *  - useToast → banner msg page-local; SubNav/KETOAN_NAV/Button/Card (v4) →
 *    KeToanNav + Tailwind (pattern khach-hang/page.tsx); fmtMoney → fmtVnd.
 *  - useEffect đặt SAU early-return trong draft là bug hook-order tiềm ẩn →
 *    dời toàn bộ hook lên đầu (hành vi giữ nguyên, đúng Rules of Hooks).
 *  - Xuất PDF v4 (fetch /api/export/ke-toan + header x-session-token tự quản)
 *    → v5 auth bằng cookie HttpOnly `sid` (lib/auth.ts) nên bỏ header, cookie
 *    tự gửi (credentials same-origin). Route /api/export/ke-toan CHƯA có ở v5
 *    (ngoài phạm vi port UI này — tương tự phNhapCreate; lỗi sẽ hiện banner).
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

/** Khớp ReportResult của lib/core/ketoan.ts:299 (bỏ so_quy — báo cáo không dùng). */
type ReportResult = {
  ky: { tu_ngay: string; den_ngay: string };
  cdkt: Array<{ ma_so: string; ten: string; loai: string; du_no: number; du_co: number; so_du: number }>;
  tong_tai_san: number;
  tong_nguon: number;
  chi_phi: Array<{ ma_so: string; ten: string; du_no: number }>;
  so_152: Array<Record<string, unknown>>;
  so_331: Array<Record<string, unknown>>;
  so_133: Array<Record<string, unknown>>;
};

const inputCls =
  'rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';
const btnPrimary =
  'inline-flex items-center rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
const btnGhost =
  'inline-flex items-center rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50';
const cardCls = 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm';

function SoTaiKhoanCol({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <div className={cardCls}>
      <div className="border-b border-slate-200 p-3 font-medium text-slate-700">{title}</div>
      <div className="max-h-64 overflow-y-auto overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="px-2 py-1 font-medium">Ngày</th>
              <th className="px-2 py-1 font-medium">Ref</th>
              <th className="px-2 py-1 text-right font-medium">Nợ</th>
              <th className="px-2 py-1 text-right font-medium">Có</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-1">{String(r.ngay ?? '')}</td>
                <td className="px-2 py-1">
                  {String(r.ref_type ?? '')}:{String(r.ref_id ?? '')}
                </td>
                <td className="px-2 py-1 text-right">{fmtVnd(Number(r.du_no ?? 0))}</td>
                <td className="px-2 py-1 text-right">{fmtVnd(Number(r.du_co ?? 0))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-slate-400">Không có phát sinh</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BaoCaoPage() {
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
  const canBaoCao = has('baocao');

  const [tuNgay, setTuNgay] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [denNgay, setDenNgay] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [report, setReport] = React.useState<ReportResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadReport = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.call('ledgerReport', { tu_ngay: tuNgay, den_ngay: denNgay });
      if (r.ok && r.result) setReport(r.result as ReportResult);
      else setMsg({ kind: 'err', text: (!r.ok && r.error) || 'Lỗi tải báo cáo' });
    } catch {
      setMsg({ kind: 'err', text: 'Lỗi tải báo cáo' });
    } finally {
      setLoading(false);
    }
  }, [api, tuNgay, denNgay]);

  React.useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuNgay, denNgay]);

  async function exportReport() {
    if (!report) return;
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (tuNgay) params.set('tu_ngay', tuNgay);
      if (denNgay) params.set('den_ngay', denNgay);
      const res = await fetch(`/api/export/ke-toan?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ke-toan_${tuNgay}_${denNgay}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ kind: 'ok', text: 'Đã xuất PDF' });
    } catch (e) {
      setMsg({ kind: 'err', text: 'Lỗi xuất PDF: ' + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setPdfLoading(false);
    }
  }

  if (!canXem) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <KeToanNav />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          {tags === null ? 'Đang tải…' : 'Bạn không có quyền xem báo cáo.'}
        </div>
      </div>
    );
  }

  const kyBar = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Từ</span>
        <input
          data-testid="kt-bc-tu"
          className={inputCls + ' w-40'}
          type="date"
          value={tuNgay}
          onChange={(e) => setTuNgay(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Đến</span>
        <input
          data-testid="kt-bc-den"
          className={inputCls + ' w-40'}
          type="date"
          value={denNgay}
          onChange={(e) => setDenNgay(e.target.value)}
        />
      </div>
      <button type="button" data-testid="kt-bc-load" onClick={() => void loadReport()} disabled={loading} className={btnPrimary}>
        {loading ? 'Đang tải...' : report ? 'Tải lại' : 'Xem báo cáo'}
      </button>
      {canBaoCao && report && (
        <button type="button" data-testid="kt-bc-export" onClick={exportReport} disabled={pdfLoading} className={btnGhost}>
          {pdfLoading ? 'Xuất PDF...' : 'Xuất PDF'}
        </button>
      )}
    </div>
  );

  const msgBanner = msg && (
    <div
      data-testid="kt-bc-msg"
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

  if (!report) {
    return (
      <div className="mx-auto max-w-6xl p-4" data-ws="ketoan">
        <KeToanNav />
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-slate-800">Báo cáo Kế toán</h1>
          <div className="text-sm text-slate-500">CĐKT, KQHĐKD chi phí, sổ 152/331/133</div>
        </div>
        {msgBanner}
        <div className={cardCls + ' p-4'}>
          {kyBar}
          <div className="py-8 text-center text-slate-400">
            {loading ? 'Đang tải báo cáo…' : 'Chọn kỳ và nhấn "Xem báo cáo"'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4" data-ws="ketoan">
      <KeToanNav />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Báo cáo Kế toán</h1>
        <div className="text-sm text-slate-500">
          Kỳ: {report.ky.tu_ngay} → {report.ky.den_ngay}
        </div>
      </div>
      {msgBanner}
      {kyBar}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div data-testid="kt-bc-tong-ts" className={cardCls + ' p-4'}>
          <div className="mb-2 text-sm text-slate-500">Tổng tài sản</div>
          <div className="text-3xl font-bold text-blue-700">{fmtVnd(report.tong_tai_san)}</div>
        </div>
        <div data-testid="kt-bc-tong-nv" className={cardCls + ' p-4'}>
          <div className="mb-2 text-sm text-slate-500">Tổng nguồn vốn</div>
          <div className="text-3xl font-bold text-green-700">{fmtVnd(report.tong_nguon)}</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardCls}>
          <div className="border-b border-slate-200 p-3 font-medium text-slate-700">I. Cân đối kế toán</div>
          <div className="overflow-x-auto p-3">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1 font-medium">Mã</th>
                  <th className="px-2 py-1 font-medium">Tên</th>
                  <th className="px-2 py-1 font-medium">Loại</th>
                  <th className="px-2 py-1 text-right font-medium">Nợ</th>
                  <th className="px-2 py-1 text-right font-medium">Có</th>
                  <th className="px-2 py-1 text-right font-medium">Số dư</th>
                </tr>
              </thead>
              <tbody>
                {report.cdkt.map((r) => (
                  <tr key={r.ma_so} className={'border-t border-slate-100 ' + (r.so_du !== 0 ? '' : 'bg-slate-50')}>
                    <td className="px-2 py-1 font-mono">{r.ma_so}</td>
                    <td className="px-2 py-1">{r.ten}</td>
                    <td className="px-2 py-1 text-slate-500">{r.loai}</td>
                    <td className="px-2 py-1 text-right">{fmtVnd(r.du_no)}</td>
                    <td className="px-2 py-1 text-right">{fmtVnd(r.du_co)}</td>
                    <td className="px-2 py-1 text-right font-medium">{fmtVnd(r.so_du)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardCls}>
          <div className="border-b border-slate-200 p-3 font-medium text-slate-700">II. Chi phí (KQHĐKD)</div>
          <div className="overflow-x-auto p-3">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1 font-medium">Mã</th>
                  <th className="px-2 py-1 font-medium">Tên</th>
                  <th className="px-2 py-1 text-right font-medium">Nợ (chi phí)</th>
                </tr>
              </thead>
              <tbody>
                {report.chi_phi.map((r) => (
                  <tr key={r.ma_so} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-mono">{r.ma_so}</td>
                    <td className="px-2 py-1">{r.ten}</td>
                    <td className="px-2 py-1 text-right">{fmtVnd(r.du_no)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SoTaiKhoanCol title="Sổ 152 (NLVT)" rows={report.so_152} />
        <SoTaiKhoanCol title="Sổ 331 (Phải trả NCC)" rows={report.so_331} />
        <SoTaiKhoanCol title="Sổ 133 (VAT đầu vào)" rows={report.so_133} />
      </div>
    </div>
  );
}
