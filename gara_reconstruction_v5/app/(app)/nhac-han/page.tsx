'use client';

/**
 * app/(app)/nhac-han/page.tsx — Nhắc hạn đăng kiểm/bảo hiểm + Lịch bảo dưỡng
 * định kỳ (v5).
 * PORT từ draft v4 `apps/web/app/(app)/nhac-han/page.tsx` (branch
 * `draft/gd4-gd5-v4) — bảng nhắc hạn (cols bks/hang/dong/loai/han/còn lại,
 * select 15/30/60/90 ngày, color quá hạn đỏ / ≤7 ngày cam) — và bổ sung
 * mục "Lịch bảo dưỡng" tiêu thụ lib/core/baoduong.ts (baoDuongTao/baoDuongList)
 * vì module port lần này là BẢO DƯỠNG ĐỊNH KỲ.
 *
 * Adaptation v4 → v5 (ghi nhận):
 *  • useRpc() hook v4 không tồn tại ở v5 → fetch /api/rpc POST {fn,args}
 *    theo contract (route bọc {ok,result}) — cùng khuôn callRpc page-local
 *    xe/page.tsx:51 (rule boundary: không sửa file ngoài 2 file được giao;
 *    dedupe helper làm ở wave consolidation, precedent xe/page.tsx:30–34).
 *  • Row click: /xe/<bks> (detail route v4) → v5 chưa có /xe/[id] → điều
 *    hướng /xe?q=<bien_so> (bảng xe v5 hỗ trợ ?q= + globalSearch — W4.5a).
 *  • graceful degrade: 'xeReminders'/'baoDuongTao'/'baoDuongList' CHƯA đăng
 *    ký lib/rpc.ts (task này cấm sửa) → isFnUnavailable (404 'Unknown fn')
 *    hiển thị cảnh báo thay vì crash — trang vẫn hữu ích khi reg hoàn tất.
 *  • Bảng nhắc hạn đọc từ fn (không tự tính client-side): v5 `xe` chưa có
 *    cột han_dang_kiem/han_bao_hiem — columns này thuộc draft v4 xe.ts —
 *    suy từ data nguồn, không bịa số (nguyên tắc W4.5a).
 * Bảo mật output: React text-node escaping mặc định — không
 * dangerouslySetInnerHTML; mọi dữ liệu render đều qua String()/number guard.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useApi, type RpcResult } from '@/lib/hooks/useApi';

/* ───────────────────────── page-local helpers ─────────────────────────
 * Mirror đúng isFnUnavailable + callRpc (xe/page.tsx:38,51) — cùng bài toán
 * graceful khi fn chưa vào registry; KHÔNG import components/** (rule task).
 * ─────────────────────────────────────────────────────────────────────── */

/** 'Unknown fn'/404 → fn chưa vào registry (khác lỗi nghiệp vụ envelope). */
function isFnUnavailable(res: RpcResult): boolean {
  if (res.ok) return false;
  if (res.status === 404) return true;
  const e = String(res.error || '').toLowerCase();
  return e.includes('unknown fn') || e.includes('fn chưa khả dụng');
}

/** RPC trực tiếp không qua useApi (tránh Spinner phủ trang mỗi lần đổi select). */
async function callRpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.ok) {
      return { ok: false, error: data?.error || 'Lỗi server', status: res.status };
    }
    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Lỗi mạng', status: 0 };
  }
}

/**
 * Unwrap 2 tầng an toàn cho fn trả MẢNG thẳng (xeReminders/baoDuongList draft —
 * HANDLERS reg `(api,a)=>core(api,a)` → route bọc {ok:true,result:[...]})
 * hoặc envelope {ok,result}. Lỗi nghiệp vụ {ok:false,error} → msg hiển thị.
 */
function normalizeList(res: RpcResult): { rows: any[]; fnDown: boolean; bizError: string | null } {
  if (isFnUnavailable(res)) return { rows: [], fnDown: true, bizError: null };
  if (!res.ok) return { rows: [], fnDown: false, bizError: String(res.error || 'Lỗi gọi RPC') };
  const inner = res.result as any;
  if (Array.isArray(inner)) return { rows: inner, fnDown: false, bizError: null };
  if (inner && typeof inner === 'object') {
    if (inner.ok === false) return { rows: [], fnDown: false, bizError: String(inner.error || 'Lỗi nghiệp vụ') };
    if (Array.isArray(inner.result)) return { rows: inner.result, fnDown: false, bizError: null };
  }
  return { rows: [], fnDown: false, bizError: 'Định dạng phản hồi không hợp lệ' };
}

function fmt(v: unknown): string {
  const s = String(v ?? '').trim();
  return s || '—';
}

/** Color cột "Còn lại" ≡ draft: quá hạn đỏ, ≤7 ngày cam, còn lại mặc định. */
function remColor(con: number): string {
  if (con < 0) return 'text-red-600';
  if (con <= 7) return 'text-amber-600';
  return 'text-slate-700';
}

interface RemRow {
  bks?: string | null;
  hang?: string | null;
  dong?: string | null;
  loai?: string | null;
  han?: string | null;
  con_bao_nhieu_ngay?: number | null;
}

interface BdRow {
  id: string;
  xe_id?: string;
  hang_muc?: string;
  ngay_du_kien?: string;
  ngay_thuc_hien?: string;
  trang_thai?: string;
}

interface XeOpt {
  id: string;
  bien_so?: string | null;
}

const BD_TT: Record<string, string> = {
  cho: 'bg-slate-100 text-slate-700',
  xong: 'bg-emerald-100 text-emerald-800',
  bo: 'bg-rose-100 text-rose-700',
};

export default function NhacHanPage() {
  const router = useRouter();
  const api = useApi();

  /* ── Nhắc hạn đăng kiểm/bảo hiểm (fn xeReminders — draft xe.ts:117) ── */
  const [days, setDays] = React.useState(30);
  const [remRows, setRemRows] = React.useState<RemRow[]>([]);
  const [remLoading, setRemLoading] = React.useState(true);
  const [remDown, setRemDown] = React.useState(false);
  const [remError, setRemError] = React.useState<string | null>(null);
  const remReq = React.useRef(0);

  /* ── Lịch bảo dưỡng theo xe (lib/core/baoduong.ts) ── */
  const [xeList, setXeList] = React.useState<XeOpt[]>([]);
  const [xeId, setXeId] = React.useState('');
  const [bdRows, setBdRows] = React.useState<BdRow[]>([]);
  const [bdLoading, setBdLoading] = React.useState(false);
  const [bdDown, setBdDown] = React.useState(false);
  const [bdError, setBdError] = React.useState<string | null>(null);
  const bdReq = React.useRef(0);
  const [form, setForm] = React.useState({ hang_muc: '', ngay_du_kien: '', trang_thai: 'cho' });
  const [formMsg, setFormMsg] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const loadReminders = React.useCallback(async (d: number) => {
    const my = ++remReq.current;
    setRemLoading(true);
    setRemError(null);
    const res = await callRpc('xeReminders', { days: d });
    if (my !== remReq.current) return; // có truy vấn mới hơn — bỏ response cũ
    const { rows, fnDown, bizError } = normalizeList(res);
    setRemRows(rows as RemRow[]);
    setRemDown(fnDown);
    setRemError(bizError);
    setRemLoading(false);
  }, []);

  const loadXeList = React.useCallback(async () => {
    const res = await api.call('xeList');
    if (res.ok) setXeList((res.result as XeOpt[]) ?? []);
  }, [api]);

  const loadBaoDuong = React.useCallback(async (id: string) => {
    const my = ++bdReq.current;
    if (!id) {
      setBdRows([]);
      setBdDown(false);
      setBdError(null);
      return;
    }
    setBdLoading(true);
    setBdError(null);
    const res = await callRpc('baoDuongList', { xe_id: id });
    if (my !== bdReq.current) return;
    const { rows, fnDown, bizError } = normalizeList(res);
    setBdRows(rows as BdRow[]);
    setBdDown(fnDown);
    setBdError(bizError);
    setBdLoading(false);
  }, []);

  React.useEffect(() => {
    loadReminders(days);
    loadXeList();
  }, [days, loadReminders, loadXeList]);

  React.useEffect(() => {
    loadBaoDuong(xeId);
  }, [xeId, loadBaoDuong]);

  const submitBaoDuong = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormMsg(null);
    const hangMuc = form.hang_muc.trim();
    if (!xeId) {
      setFormMsg('Chọn xe trước khi tạo lịch.');
      return;
    }
    if (!hangMuc) {
      setFormMsg('Thiếu hạng mục bảo dưỡng.');
      return;
    }
    if (hangMuc.length > 200) {
      setFormMsg('Hạng mục tối đa 200 ký tự.');
      return;
    }
    if (!['cho', 'xong', 'bo'].includes(form.trang_thai)) {
      setFormMsg('Trạng thái không hợp lệ.');
      return;
    }
    setSaving(true);
    const res = await callRpc('baoDuongTao', {
      xe_id: xeId,
      hang_muc: hangMuc,
      ngay_du_kien: form.ngay_du_kien || undefined,
      trang_thai: form.trang_thai,
    });
    setSaving(false);
    if (isFnUnavailable(res)) {
      setFormMsg('Báo cho quản trị: fn baoDuongTao chưa đăng ký trong lib/rpc.ts.');
      return;
    }
    if (!res.ok) {
      setFormMsg(res.error || 'Tạo lịch thất bại');
      return;
    }
    const inner = res.result as { ok?: boolean; id?: string; error?: string } | undefined;
    if (inner && inner.ok === false) {
      setFormMsg(inner.error || 'Tạo lịch thất bại');
      return;
    }
    setForm({ hang_muc: '', ngay_du_kien: '', trang_thai: 'cho' });
    loadBaoDuong(xeId);
  };

  return (
    <div className="min-h-[50vh] space-y-8">
      {/* ════════════ Nhắc hạn đăng kiểm / bảo hiểm ════════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Nhắc hạn đăng kiểm / bảo hiểm</h1>
          <div className="flex items-center gap-2">
            <select
              aria-label="Số ngày tới"
              data-testid="nhac-han-days"
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[15, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} ngày tới
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadReminders(days)}
              disabled={remLoading}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Làm mới
            </button>
          </div>
        </div>

        {remDown && (
          <div
            data-testid="nhac-han-fn-down"
            className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            fn <code>xeReminders</code> chưa đăng ký trong lib/rpc.ts (port draft v4
            packages/core/src/xe.ts đang chờ reg) — bảng nhắc hạn trống tạm thời.
          </div>
        )}
        {remError && (
          <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{remError}</div>
        )}

        <div data-testid="nhac-han-table" className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Biển số</th>
                <th className="px-3 py-2">Hãng</th>
                <th className="px-3 py-2">Kiểu</th>
                <th className="px-3 py-2">Hạn thuộc</th>
                <th className="px-3 py-2">Hạn</th>
                <th className="px-3 py-2">Còn</th>
              </tr>
            </thead>
            <tbody>
              {remLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Đang tải…
                  </td>
                </tr>
              ) : remRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Không có xe đến hạn
                  </td>
                </tr>
              ) : (
                remRows.map((r, i) => {
                  const con = Number(r.con_bao_nhieu_ngay);
                  const conN = Number.isFinite(con) ? con : 0;
                  return (
                    <tr
                      key={`${r.bks ?? 'r'}-${r.loai ?? ''}-${i}`}
                      onClick={() => r.bks && router.push('/xe?q=' + encodeURIComponent(String(r.bks)))}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 font-mono">{fmt(r.bks)}</td>
                      <td className="px-3 py-2">{fmt(r.hang)}</td>
                      <td className="px-3 py-2">{fmt(r.dong)}</td>
                      <td className="px-3 py-2">{fmt(r.loai)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(r.han)}</td>
                      <td className={`px-3 py-2 font-bold ${remColor(conN)}`}>
                        {conN < 0 ? `Quá hạn ${-conN} ngày` : `${conN} ngày`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ════════════ Lịch bảo dưỡng định kỳ (lib/core/baoduong.ts) ════════════ */}
      <section data-testid="baoduong-section">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">Lịch bảo dưỡng định kỳ</h2>
          <select
            aria-label="Chọn xe"
            data-testid="bd-xe-select"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            value={xeId}
            onChange={(e) => setXeId(e.target.value)}
          >
            <option value="">— Chọn xe —</option>
            {xeList.map((x) => (
              <option key={x.id} value={x.id}>
                {fmt(x.bien_so)} ({x.id})
              </option>
            ))}
          </select>
        </div>

        {bdDown && (
          <div
            data-testid="bd-fn-down"
            className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            fn <code>baoDuongList</code>/<code>baoDuongTao</code> chưa đăng ký trong
            lib/rpc.ts — core <code>lib/core/baoduong.ts</code> đã sẵn sàng, chờ reg
            (hướng dẫn trong header file core).
          </div>
        )}
        {bdError && (
          <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{bdError}</div>
        )}

        {xeId && (
          <div data-testid="bd-list" className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Hạng mục</th>
                  <th className="px-3 py-2">Ngày dự kiến</th>
                  <th className="px-3 py-2">Ngày thực hiện</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {bdLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                      Đang tải…
                    </td>
                  </tr>
                ) : bdRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                      Chưa có lịch bảo dưỡng cho xe này.
                    </td>
                  </tr>
                ) : (
                  bdRows.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-mono">{fmt(b.id)}</td>
                      <td className="px-3 py-2">{fmt(b.hang_muc)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(b.ngay_du_kien)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(b.ngay_thuc_hien)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            BD_TT[String(b.trang_thai)] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {fmt(b.trang_thai)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={submitBaoDuong}
          data-testid="bd-form"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Hạng mục *</label>
            <input
              type="text"
              required
              maxLength={200}
              value={form.hang_muc}
              onChange={(e) => setForm({ ...form, hang_muc: e.target.value })}
              placeholder="VD: Thay nhớt, ROTUYN…"
              data-testid="bd-hang-muc"
              className="mt-1 block w-64 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Ngày dự kiến</label>
            <input
              type="date"
              value={form.ngay_du_kien}
              onChange={(e) => setForm({ ...form, ngay_du_kien: e.target.value })}
              data-testid="bd-ngay-du-kien"
              className="mt-1 block rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Trạng thái</label>
            <select
              value={form.trang_thai}
              onChange={(e) => setForm({ ...form, trang_thai: e.target.value })}
              data-testid="bd-trang-thai"
              className="mt-1 block rounded border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="cho">cho</option>
              <option value="xong">xong</option>
              <option value="bo">bo</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving || !xeId || api.loading}
            data-testid="bd-submit"
            className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu…' : 'Thêm lịch'}
          </button>
          {!xeId && <span className="text-xs text-slate-500">Chọn xe ở trên để tạo lịch.</span>}
        </form>
        {formMsg && (
          <p data-testid="bd-form-msg" className="mt-2 text-sm text-rose-700" role="alert">
            {formMsg}
          </p>
        )}
      </section>
    </div>
  );
}
