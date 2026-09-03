'use client';

/**
 * Trang Nhập kho & VAT đầu vào — port từ draft v4
 * apps/web/app/(app)/ke-toan/nhap-vat/page.tsx (commit 8397979), giữ hành vi:
 *  - Card 1: form đa dòng tạo phiếu nhập (vật tư + SL + đơn giá, NCC, ghi chú,
 *    checkbox "Trả ngay (Có 112)") → RPC phNhapCreate {items, nha_cc, ghi_chu,
 *    tra_ngay}.
 *  - Card 2: form HĐ VAT đầu vào → RPC vatInvoiceSave (Nợ 133 / Có 331),
 *    validate thiếu số HĐ / tiền thuế ngay client.
 *  - Gate nút soạn thảo bằng nhãn vat (ke_toan.vat); chỉ người có quyền thấy nút.
 * Adapt sang convention v5:
 *  - useRpc/rpc (v4) → useApi().call(fn, argsObj); args OBJECT theo contract
 *    POST /api/rpc của v5 (đường dẫn handler lib/rpc.ts W6-reg).
 *  - vatTuList (v4) → vattuList (tên đăng ký thật trong lib/rpc.ts; handler
 *    kho.vattuList trả SELECT * FROM vattu → trường ten/don_vi/gia thay vì
 *    name/donvi như v4; id là VARCHAR PREFIX-000001 nên chuyển number → string).
 *  - phNhapCreate CHƯA được đăng ký ở lib/rpc.ts v5 (core chưa port từ draft —
 *    ghi chú ngoài phạm vi port UI này, giống tiền lệ khach-hang/page.tsx);
 *    tên fn + payload giữ NGUYÊN để backend nối vào là chạy.
 *  - useToast → banner msg page-local (pattern khach-hang/page.tsx).
 *  - SubNav/KETOAN_NAV/Button/Card/fmtMoney (v4) → KeToanNav + nút Tailwind +
 *    fmtVnd page-local.
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

const inputCls =
  'rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';

/** vattuList v5: SELECT * FROM vattu — id VARCHAR(12), ten/don_vi/gia. */
type VT = { id: string; ten: string; don_vi?: string | null; gia?: number | null };

/** Gộp envelope giao-vận (RpcResult) + envelope nghiệp vụ {ok,error} trong lõi. */
async function callEnv(
  call: (fn: string, args?: any) => Promise<{ ok: boolean; result?: any; error?: string; status?: number }>,
  fn: string,
  args?: Record<string, unknown>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await call(fn, args);
  if (!res.ok) return { ok: false, error: res.error || 'Lỗi server' };
  const env = res.result;
  if (env && typeof env === 'object' && 'ok' in env) {
    return { ok: !!env.ok, id: env.id, error: env.error };
  }
  return { ok: true, id: env?.id };
}

export default function NhapVatPage() {
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
  const canTao = has('vat');
  const canXem = has('xem');

  const [list, setList] = React.useState<VT[]>([]);
  React.useEffect(() => {
    let active = true;
    void (async () => {
      const r = await api.call('vattuList', {});
      if (active && r.ok) setList((r.result as VT[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [api]);

  const [showNhap, setShowNhap] = React.useState(false);
  const [showVat, setShowVat] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Nhập kho form state (id vật tư là chuỗi PREFIX-000001 ở v5 — rỗng = chưa chọn)
  const [nhapItems, setNhapItems] = React.useState<{ vattu_id: string; so_luong: string; dgia: string }[]>([
    { vattu_id: '', so_luong: '1', dgia: '0' },
  ]);
  const [nhaCc, setNhaCc] = React.useState('');
  const [ghiChu, setGhiChu] = React.useState('');
  const [traNgay, setTraNgay] = React.useState(false);

  // VAT form state
  const [vatSoHd, setVatSoHd] = React.useState('');
  const [vatTienHang, setVatTienHang] = React.useState('');
  const [vatTienThue, setVatTienThue] = React.useState('');
  const [vatTyLe, setVatTyLe] = React.useState('10');
  const [vatNgay, setVatNgay] = React.useState(() => new Date().toISOString().split('T')[0]);
  const [vatRefId, setVatRefId] = React.useState('');
  const [vatNcc, setVatNcc] = React.useState('');

  function updNhap(i: number, k: 'vattu_id' | 'so_luong' | 'dgia', val: string) {
    setNhapItems((a) => a.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  }

  async function saveNhap() {
    const its = nhapItems
      .filter((it) => it.vattu_id && Number(it.so_luong) > 0)
      .map((it) => {
        const vt = list.find((v) => v.id === it.vattu_id);
        return {
          vattu_id: it.vattu_id,
          so_luong: Number(it.so_luong),
          dgia: Number(it.dgia) || (vt ? Number(vt.gia) || 0 : 0),
        };
      });
    if (!its.length) {
      setMsg({ kind: 'err', text: 'Chưa chọn vật tư' });
      return;
    }
    setBusy(true);
    try {
      const r = await callEnv(api.call.bind(api), 'phNhapCreate', {
        items: its,
        nha_cc: nhaCc || undefined,
        ghi_chu: ghiChu || undefined,
        tra_ngay: traNgay,
      });
      if (r.ok) {
        setMsg({ kind: 'ok', text: 'Đã tạo phiếu nhập ' + (r.id ?? '') });
        setShowNhap(false);
      } else setMsg({ kind: 'err', text: r.error || 'Thất bại' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Lỗi mạng: ' + (e?.message ?? String(e)) });
    } finally {
      setBusy(false);
    }
  }

  async function saveVat() {
    if (!vatSoHd || !vatTienThue) {
      setMsg({ kind: 'err', text: 'Thiếu số HĐ hoặc tiền thuế' });
      return;
    }
    setBusy(true);
    try {
      const r = await callEnv(api.call.bind(api), 'vatInvoiceSave', {
        so_hd: vatSoHd,
        tien_thue: Number(vatTienThue),
        tien_hang: Number(vatTienHang) || 0,
        ty_le: Number(vatTyLe) || 0,
        ngay: vatNgay,
        ref_id: vatRefId || undefined,
        ncc: vatNcc || undefined,
      });
      if (r.ok) {
        setMsg({ kind: 'ok', text: 'Đã lưu HĐ VAT ' + (r.id ?? '') });
        setShowVat(false);
      } else setMsg({ kind: 'err', text: r.error || 'Thất bại' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Lỗi mạng: ' + (e?.message ?? String(e)) });
    } finally {
      setBusy(false);
    }
  }

  const btnPrimary =
    'inline-flex items-center rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
  const btnGhost =
    'inline-flex items-center rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50';

  return (
    <div className="mx-auto max-w-6xl p-4" data-ws="ketoan">
      <KeToanNav />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Nhập kho & VAT đầu vào</h1>
        <div className="text-sm text-slate-500">Tạo phiếu nhập vật tư + lưu HĐ VAT (Nợ 133 / Có 331)</div>
      </div>

      {msg && (
        <div
          data-testid="kt-nv-msg"
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

      {!canXem && tags !== null && (
        <div className="mb-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
          Bạn không có quyền xem module Kế toán — chỉ hiển thị biểu mẫu, thao tác ghi sẽ bị server từ chối.
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-slate-700">Tạo phiếu nhập kho</h3>
            {canTao && (
              <button type="button" data-testid="kt-btn-nhap" onClick={() => setShowNhap(true)} className={btnPrimary}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tạo mới
              </button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="kt-nhap-ncc"
                className={inputCls + ' flex-1'}
                placeholder="Nhà cung cấp"
                maxLength={255}
                value={nhaCc}
                onChange={(e) => setNhaCc(e.target.value)}
              />
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  data-testid="kt-nhap-trangay"
                  checked={traNgay}
                  onChange={(e) => setTraNgay(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Trả ngay (Có 112)
              </label>
            </div>
            <textarea
              data-testid="kt-nhap-ghichu"
              className={inputCls}
              rows={2}
              placeholder="Ghi chú"
              maxLength={1000}
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
            />
            <div className="space-y-2">
              {nhapItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    data-testid={`kt-nhap-vt-${i}`}
                    className={inputCls + ' flex-1'}
                    value={it.vattu_id}
                    onChange={(e) => updNhap(i, 'vattu_id', e.target.value)}
                  >
                    <option value="">Chọn vật tư…</option>
                    {list.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.ten} ({v.don_vi || ''}) - {fmtVnd(Number(v.gia))}
                      </option>
                    ))}
                  </select>
                  <input
                    data-testid={`kt-nhap-sl-${i}`}
                    className={inputCls + ' w-16'}
                    type="number"
                    min={0}
                    value={it.so_luong}
                    onChange={(e) => updNhap(i, 'so_luong', e.target.value)}
                  />
                  <input
                    data-testid={`kt-nhap-dg-${i}`}
                    className={inputCls + ' w-24'}
                    type="number"
                    min={0}
                    placeholder="Đơn giá"
                    value={it.dgia}
                    onChange={(e) => updNhap(i, 'dgia', e.target.value)}
                  />
                  <button
                    type="button"
                    data-testid={`kt-nhap-del-${i}`}
                    className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    onClick={() => setNhapItems((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : a))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                data-testid="kt-nhap-addrow"
                className="rounded px-2 py-1 text-sm text-indigo-600 hover:bg-indigo-50"
                onClick={() => setNhapItems((a) => [...a, { vattu_id: '', so_luong: '1', dgia: '0' }])}
              >
                + Thêm dòng
              </button>
            </div>
            {showNhap && (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowNhap(false)} className={btnGhost}>
                  Hủy
                </button>
                <button type="button" data-testid="kt-btn-nhap-save" onClick={saveNhap} disabled={busy || api.loading} className={btnPrimary}>
                  {busy ? 'Đang lưu…' : 'Tạo phiếu nhập'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-slate-700">Lưu HĐ VAT đầu vào (Nợ 133 / Có 331)</h3>
            {canTao && (
              <button type="button" data-testid="kt-btn-vat" onClick={() => setShowVat(true)} className={btnPrimary}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Lưu HĐ
              </button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="kt-vat-sohd"
                className={inputCls}
                placeholder="Số HĐ"
                maxLength={64}
                value={vatSoHd}
                onChange={(e) => setVatSoHd(e.target.value)}
              />
              <input
                data-testid="kt-vat-ngay"
                className={inputCls}
                type="date"
                value={vatNgay}
                onChange={(e) => setVatNgay(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                data-testid="kt-vat-tienhang"
                className={inputCls}
                placeholder="Tiền hàng"
                type="number"
                min={0}
                value={vatTienHang}
                onChange={(e) => setVatTienHang(e.target.value)}
              />
              <input
                data-testid="kt-vat-tienthue"
                className={inputCls}
                placeholder="Tiền thuế"
                type="number"
                min={0}
                value={vatTienThue}
                onChange={(e) => setVatTienThue(e.target.value)}
              />
              <input
                data-testid="kt-vat-tyle"
                className={inputCls}
                placeholder="TL %"
                type="number"
                min={0}
                max={100}
                value={vatTyLe}
                onChange={(e) => setVatTyLe(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="kt-vat-ncc"
                className={inputCls}
                placeholder="NCC (tự điền)"
                maxLength={255}
                value={vatNcc}
                onChange={(e) => setVatNcc(e.target.value)}
              />
              <input
                data-testid="kt-vat-refid"
                className={inputCls}
                placeholder="Ref ID (phiếu nhập)"
                maxLength={12}
                value={vatRefId}
                onChange={(e) => setVatRefId(e.target.value)}
              />
            </div>
            {showVat && (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowVat(false)} className={btnGhost}>
                  Hủy
                </button>
                <button type="button" data-testid="kt-btn-vat-save" onClick={saveVat} disabled={busy || api.loading} className={btnPrimary}>
                  {busy ? 'Đang lưu…' : 'Lưu HĐ VAT'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
