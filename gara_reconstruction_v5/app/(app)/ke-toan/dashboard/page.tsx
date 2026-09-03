'use client';

/**
 * Trang Tổng quan Kế toán (dashboard) — port từ draft v4
 * apps/web/app/(app)/ke-toan/dashboard/page.tsx (commit 8397979), giữ hành vi:
 *  - 5 KPI card: tổng bút toán gần đây, công nợ phải trả NCC, số NCC quá hạn,
 *    thu/chi nội bộ 30 ngày + biểu đồ cơ cấu Thu/Chi.
 *  - Bảng "Sổ cái gần đây (20 dòng)" + "Công nợ NCC (top 10)".
 *  - Gate quyền ke_toan.xem — không có quyền chỉ hiện SubNav + message.
 * Adapt sang convention v5:
 *  - useRpc(fn, [args]) (v4) → useApi().call(fn, argsObj) — contract
 *    POST /api/rpc {fn,args} (args là OBJECT, không phải mảng).
 *  - useSession().perms (v4) → getCurrentUser() + tra theo MATRIX (lib/perm.ts):
 *    ke_toan 6 nhãn cấp đủ cho vai 'ketoan', admin bypass mọi nhãn.
 *    Server vẫn là nguồn thẩm quyền (checkLock trong core/ketoan.ts) —
 *    client chỉ quyết định ẩn/hiện UI.
 *  - ledgerList v5 trả bút toán từng dòng (l.*, so_ct, loai_ct, note) thay vì
 *    tổng hợp theo tài khoản như v4 → bảng đổi cột tương ứng dữ liệu thật,
 *    giữ nguyên logic "20 dòng gần đây" (hiển thị 10).
 *  - ledgerReport v5 trả so_quy = {thu, chi, rows} đã cộng sẵn → dùng trực tiếp.
 *  - SubNav/KETOAN_NAV/Card/ChartCard/fmtMoney (v4) không tồn tại ở v5 →
 *    KeToanNav page-local (pattern nav.tsx), thẻ div Tailwind
 *    (pattern khach-hang/page.tsx), cột bar Thu/Chi tự vẽ (không thêm dep),
 *    fmtVnd page-local (pattern baogia/page.tsx).
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';

/** 6 nhãn tinh module ke_toan — khớp MATRIX vai ketoan (lib/perm.ts W6-reg). */
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

/** Thay SubNav + KETOAN_NAV của v4 — page-local, không sửa components/. */
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

/** ledgerList v5: SELECT l.*, c.so_ct, c.loai_ct, c.note — bút toán từng dòng. */
type LedgerLine = {
  id: string;
  ngay: string;
  tai_khoan: string;
  du_no: number;
  du_co: number;
  so_ct?: string;
  loai_ct?: string;
  note?: string;
};

type CongNo = {
  id: string;
  doi_tac?: string | null;
  so_tien?: number | null;
  con_no?: number | null;
  tuoi_no?: number | null;
};

/** ledgerReport v5 (trích phần dashboard dùng): so_quy đã cộng sẵn thu/chi. */
type LedgerRep = {
  so_quy?: { thu?: number; chi?: number };
};

export default function KeToanDashboardPage() {
  const api = useApi();

  // perms kiểu v4 (mảng nhãn) suy từ vai trò qua getCurrentUser — null = chưa tải
  const [tags, setTags] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      const kt =
        u && (u.role === 'admin' || u.role === 'ketoan') ? KT_TAGS : [];
      setTags(kt);
    });
    return () => {
      active = false;
    };
  }, []);
  const has = (t: string) => !!tags?.includes(t);
  const canXem = has('xem');
  const canBaoCao = has('baocao');

  const [ledger, setLedger] = React.useState<LedgerLine[]>([]);
  const [congNo, setCongNo] = React.useState<CongNo[]>([]);
  const [ledgerRep, setLedgerRep] = React.useState<LedgerRep | null>(null);

  // Danh sách RPC đều fail-closed trong core khi thiếu quyền (trả [] / envelope
  // lỗi) — gọi vô điều kiện như draft, lỗi chỉ im lặng hiển thị dữ liệu rỗng.
  React.useEffect(() => {
    let active = true;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    void (async () => {
      const r1 = await api.call('ledgerList', { limit: 20 });
      if (active && r1.ok) setLedger((r1.result as LedgerLine[]) ?? []);
      const r2 = await api.call('congNoList', { loai: 'phai_tra', limit: 10 });
      if (active && r2.ok) setCongNo((r2.result as CongNo[]) ?? []);
      const r3 = await api.call('ledgerReport', {
        tu_ngay: iso(new Date(Date.now() - 30 * 864e5)),
        den_ngay: iso(new Date()),
      });
      if (active && r3.ok) setLedgerRep((r3.result as LedgerRep) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [api]);

  const rows = ledger;
  const cnRows = congNo;
  const sq = ledgerRep?.so_quy ?? {};
  const sumThu = Number(sq.thu ?? 0);
  const sumChi = Number(sq.chi ?? 0);
  const maxSq = Math.max(sumThu, sumChi, 1);

  if (!canXem) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <KeToanNav />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          {tags === null ? 'Đang tải…' : 'Bạn không có quyền xem module Kế toán.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4" data-ws="ketoan">
      <KeToanNav />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Tổng quan Kế toán</h1>
        <div className="text-sm text-slate-500">Dashboard nhanh — dữ liệu cập nhật realtime</div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div data-testid="kt-kpi-butoan" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 text-sm text-slate-500">Tổng bút toán (gần đây)</div>
          <div className="text-2xl font-bold text-slate-800">{rows.length}</div>
        </div>
        <div data-testid="kt-kpi-phai-tra" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 text-sm text-slate-500">Công nợ phải trả NCC</div>
          <div className="text-2xl font-bold text-red-600">
            {fmtVnd(cnRows.reduce((s, r) => s + Number(r.con_no || 0), 0))}
          </div>
        </div>
        <div data-testid="kt-kpi-quahan" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 text-sm text-slate-500">Số NCC quá hạn</div>
          <div className="text-2xl font-bold text-orange-600">
            {cnRows.filter((r) => Number(r.tuoi_no || 0) > 0).length}
          </div>
        </div>
        <div data-testid="kt-kpi-thu" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 text-sm text-slate-500">Thu nội bộ (30 ngày)</div>
          <div className="text-2xl font-bold text-green-600">{fmtVnd(sumThu)}</div>
        </div>
        <div data-testid="kt-kpi-chi" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-1 text-sm text-slate-500">Chi nội bộ (30 ngày)</div>
          <div className="text-2xl font-bold text-red-600">{fmtVnd(sumChi)}</div>
        </div>
        {/* ChartCard pie (v4) → cột bar thuần CSS, không thêm dependency */}
        <div data-testid="kt-chart-thuchi" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-700">Cơ cấu Thu/Chi nội bộ</div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="mb-0.5 flex justify-between text-slate-500">
                <span>Thu</span>
                <span>{fmtVnd(sumThu)}</span>
              </div>
              <div className="h-3 w-full rounded bg-slate-100">
                <div className="h-3 rounded bg-green-500" style={{ width: `${(sumThu / maxSq) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 flex justify-between text-slate-500">
                <span>Chi</span>
                <span>{fmtVnd(sumChi)}</span>
              </div>
              <div className="h-3 w-full rounded bg-slate-100">
                <div className="h-3 rounded bg-red-500" style={{ width: `${(sumChi / maxSq) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3 font-medium text-slate-700">
            Sổ cái gần đây (20 dòng)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">TK</th>
                  <th className="px-3 py-2 font-medium">Ngày</th>
                  <th className="px-3 py-2 font-medium">Chứng từ</th>
                  <th className="px-3 py-2 font-medium">Loại</th>
                  <th className="px-3 py-2 text-right font-medium">Nợ</th>
                  <th className="px-3 py-2 text-right font-medium">Có</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r) => (
                  <tr key={r.id} data-testid={`kt-ledger-${r.id}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono">{r.tai_khoan}</td>
                    <td className="px-3 py-2">{r.ngay}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.so_ct || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{r.loai_ct || '—'}</td>
                    <td className="px-3 py-2 text-right">{fmtVnd(Number(r.du_no))}</td>
                    <td className="px-3 py-2 text-right">{fmtVnd(Number(r.du_co))}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-400">Chưa có bút toán</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3 font-medium text-slate-700">
            Công nợ NCC (top 10)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Mã CN</th>
                  <th className="px-3 py-2 font-medium">Đối tác</th>
                  <th className="px-3 py-2 text-right font-medium">Số tiền</th>
                  <th className="px-3 py-2 text-right font-medium">Còn nợ</th>
                  <th className="px-3 py-2 text-right font-medium">Tuổi (ngày)</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {cnRows.map((r) => (
                  <tr key={r.id} data-testid={`kt-cn-${r.id}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                    <td className="px-3 py-2">{r.doi_tac || '—'}</td>
                    <td className="px-3 py-2 text-right">{fmtVnd(Number(r.so_tien))}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtVnd(Number(r.con_no))}</td>
                    <td className="px-3 py-2 text-right">
                      {Number(r.tuoi_no || 0) > 0 ? (
                        <span className="text-red-600">{r.tuoi_no}</span>
                      ) : (
                        r.tuoi_no
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {Number(r.con_no || 0) === 0 ? (
                        <span className="text-green-600">Đã đóng</span>
                      ) : Number(r.tuoi_no || 0) > 0 ? (
                        <span className="text-red-600">Quá hạn</span>
                      ) : (
                        <span className="text-blue-600">Đang nợ</span>
                      )}
                    </td>
                  </tr>
                ))}
                {cnRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-400">Chưa có công nợ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
