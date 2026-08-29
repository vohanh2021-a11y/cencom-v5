'use client';

import { useEffect, useState, useCallback } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';
import type { HoSoCheckResult, HoSoStep } from '@/lib/core/ho_so';

interface XeRow {
  id: string;
  bien_so: string;
  chu_xe?: string | null;
  nam_sx?: number | null;
}

interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
  ngay_tao: string;
  nguoi_tao?: string | null;
  tong?: number | null;
  tong_cong?: number | null;
  tong_vt?: number | null;
  is_test?: number;
}

interface ScDetail {
  id: string;
  xe_id: string;
  trang_thai: string;
  ngay_tao: string;
  nguoi_tao?: string | null;
  tong_cong?: number | null;
  tong_vt?: number | null;
  tong?: number | null;
}

interface ActivityRow {
  id?: string;
  ts: string;
  actor_id?: string | null;
  actor_role?: string | null;
  hanh_dong: string;
  mo_ta?: string | null;
  doi_tuong?: string | null;
  doi_tuong_id?: string | null;
  sc_id?: string | null;
}

interface VattuRow {
  id: string;
  ten: string;
  don_vi?: string | null;
  ton?: number | null;
  gia?: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  dang_sua: 'Đang sửa',
  da_hoan: 'Đã hoàn',
  tu_choi: 'Từ chối',
  da_quyet: 'Đã quyết toán',
};

const STATUS_CHIP: Record<string, string> = {
  de_xuat: 'bg-amber-100 text-amber-800',
  dang_sua: 'bg-blue-100 text-blue-800',
  da_hoan: 'bg-green-100 text-green-800',
  tu_choi: 'bg-red-100 text-red-800',
  da_quyet: 'bg-purple-100 text-purple-800',
};

const LOAI_XU_LY: Record<string, string> = {
  thay_moi: 'Thay mới',
  sua_chua: 'Sửa chữa',
  bao_duong: 'Bảo dưỡng',
  khac: 'Khác',
};

const TT_LABEL: Record<string, string> = {
  cho: 'Chờ',
  dang: 'Đang làm',
  hoan: 'Hoàn',
};

const formatDate = (ts: string) => (!ts ? '—' : String(ts).slice(0, 19).replace('T', ' '));
const money = (n?: number | string | null) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('vi-VN') + '₫';
const todayStr = () => new Date().toISOString().slice(0, 10);

/** Escape HTML entities — chống XSS khi ghép chuỗi HTML từ dữ liệu user/server */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function StatusChip({ st }: { st: string }) {
  return (
    <span
      className={
        'inline-flex rounded px-2 py-0.5 text-xs font-medium ' +
        (STATUS_CHIP[st] ?? 'bg-slate-100 text-slate-800')
      }
    >
      {STATUS_LABEL[st] ?? st}
    </span>
  );
}

interface ModalProps {
  id: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  xeMap: Map<string, string>;
  vattuList: VattuRow[];
  canSua: boolean;
  canKehoach: boolean;
}

function ScDetailModal({ id, open, onClose, onDone, xeMap, vattuList, canSua, canKehoach }: ModalProps) {
  const api = useApi();
  const [sc, setSc] = useState<ScDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actRows, setActRows] = useState<ActivityRow[]>([]);
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [showTuChoi, setShowTuChoi] = useState(false);
  const [lyDo, setLyDo] = useState('');

  const [cvMo, setCvMo] = useState('');
  const [cvNguyenNhan, setCvNguyenNhan] = useState('');
  const [cvLoai, setCvLoai] = useState('thay_moi');
  const [cvSo, setCvSo] = useState('1');
  const [cvDon, setCvDon] = useState('0');

  const [vtId, setVtId] = useState('');
  const [vtSo, setVtSo] = useState('1');

  const load = useCallback(async () => {
    setLoading(true);
    setActError(null);
    const r = await api.call('scGet', { id });
    if (r.ok) {
      setSc(r.result as ScDetail);
    } else {
      setSc(null);
      setErrLocal(r.error || 'Không tải được chi tiết SC');
    }
    setLoading(false);
  }, [api, id]);

  const [errLocal, setErrLocal] = useState<string | null>(null);
  const [hs, setHs] = useState<HoSoCheckResult | null>(null);
  const [hsLoading, setHsLoading] = useState(false);
  const [hsSaving, setHsSaving] = useState(false);
  const [khText, setKhText] = useState('');
  const [ktText, setKtText] = useState('');
  const [nnNgay, setNnNgay] = useState(todayStr());
  const [nnVt, setNnVt] = useState('0');
  const [nnNc, setNnNc] = useState('0');

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    setActError(null);
    const r = await api.call('activityFeed', { sc_id: id, limit: 100 });
    if (r.ok) {
      setActRows((r.result as ActivityRow[]) ?? []);
    } else {
      setActError(r.error || 'Không tải được hoạt động');
      setActRows([]);
    }
    setActLoading(false);
  }, [api, id]);

  const loadHoSo = useCallback(async () => {
    setHsLoading(true);
    const r = await api.call('hoSoCheck', { sc_id: id });
    if (r.ok) setHs(r.result as HoSoCheckResult);
    else setHs(null);
    setHsLoading(false);
  }, [api, id]);

  useEffect(() => {
    if (!open) return;
    setSc(null);
    setActRows([]);
    setHs(null);
    load();
    loadActivity();
    loadHoSo();
  }, [open, load, loadActivity, loadHoSo]);

  const refreshAll = useCallback(async () => {
    await load();
    await loadActivity();
    await loadHoSo();
    onDone();
  }, [load, loadActivity, loadHoSo, onDone]);

  const exportReport = useCallback(() => {
    if (!sc || !hs) return;
    const rows = hs.steps
      .map(
        (s) =>
          `<tr><td style="border:1px solid #ccc;padding:6px">${escapeHtml(String(s.step))}</td><td style="border:1px solid #ccc;padding:6px">${escapeHtml(s.label)}</td><td style="border:1px solid #ccc;padding:6px">${s.ok ? 'Đạt' : 'Thiếu'}</td><td style="border:1px solid #ccc;padding:6px">${escapeHtml(s.note || '')}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ho so SC ${escapeHtml(id)}</title><style>@page{size:A4;margin:16mm} body{font-family:Arial,Helvetica,sans-serif;color:#222} h2{text-align:center} table{border-collapse:collapse;width:100%;margin-top:12px} th,td{border:1px solid #ccc;padding:6px;font-size:13px}</style></head><body><h2>HỒ SƠ SỬA CHỮA 8 BƯỚC</h2><p><b>SC:</b> ${escapeHtml(id)} &nbsp; <b>Trạng thái:</b> ${escapeHtml(sc.trang_thai)} &nbsp; <b>Ngày:</b> ${escapeHtml(formatDate(sc.ngay_tao))}</p><p><b>Kết luận:</b> ${hs.ok ? 'Đạt đủ — có thể quyết toán' : 'Thiếu: ' + escapeHtml(hs.miss.join(', '))}</p><table><thead><tr><th style="border:1px solid #ccc;padding:6px">#</th><th style="border:1px solid #ccc;padding:6px">Bước hồ sơ</th><th style="border:1px solid #ccc;padding:6px">Kết quả</th><th style="border:1px solid #ccc;padding:6px">Ghi chú</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:16px;font-size:12px;color:#666">In ra PDF qua trình duyệt (Ctrl+P).</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoso_${id}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [sc, hs, id]);

  const saveHoSo = useCallback(async () => {
    setHsSaving(true);
    setActError(null);
    const r = await api.call('hoSoSave', {
      sc_id: id,
      ghi_chu: hs?.ok ? 'Hồ sơ 8 bước đạt đủ' : 'Hồ sơ 8 bước thiếu: ' + (hs?.miss.join(', ') || ''),
    });
    if (!r.ok) setActError(r.error || 'Lưu hồ sơ thất bại');
    setHsSaving(false);
  }, [api, id, hs]);

  const gotoStep = (s: HoSoStep) => {
    if (s.link === 'kh') document.getElementById('kh-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (s.link === 'kt') document.getElementById('kt-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (s.link === 'nn') document.getElementById('nn-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (typeof s.link === 'string' && s.link.startsWith('/')) window.open(s.link, '_blank');
  };

  const saveKh = async () => {
    setMutating(true);
    const r = await api.call('keHoachSave', { sc_id: id, mo_ta: khText.trim() });
    if (r.ok) {
      setKhText('');
      await refreshAll();
    } else setActError(r.error || 'Lưu kế hoạch thất bại');
    setMutating(false);
  };
  const saveKt = async () => {
    setMutating(true);
    const r = await api.call('kiemTuSave', { sc_id: id, mo_ta: ktText.trim() });
    if (r.ok) {
      setKtText('');
      await refreshAll();
    } else setActError(r.error || 'Lưu kiểm tu thất bại');
    setMutating(false);
  };
  const saveNn = async () => {
    setMutating(true);
    const r = await api.call('nghiemThuSave', {
      sc_id: id,
      ngay_nghiem: nnNgay,
      tong_vat_tu: Number(nnVt) || 0,
      tong_nhan_cong: Number(nnNc) || 0,
    });
    if (r.ok) await refreshAll();
    else setActError(r.error || 'Lưu nghiệm thu thất bại');
    setMutating(false);
  };

  const doCv = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cvMo.trim()) return;
    setMutating(true);
    const r = await api.call('scAddCongViec', {
      sc_id: id,
      mo_ta: cvMo.trim(),
      nguyen_nhan: cvNguyenNhan.trim() || undefined,
      loai_xu_ly: cvLoai || undefined,
      so_luong: cvSo ? Number(cvSo) : undefined,
      don_gia: cvDon ? Number(cvDon) : undefined,
    });
    if (r.ok) {
      setCvMo(''); setCvNguyenNhan(''); setCvSo('1'); setCvDon('0');
      await refreshAll();
    } else {
      setActError(r.error || 'Thêm công việc thất bại');
    }
    setMutating(false);
  };

  const doVt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!vtId) return;
    setMutating(true);
    const r = await api.call('scAddVatTu', { sc_id: id, vattu_id: vtId, so_luong: Number(vtSo) });
    if (r.ok) {
      setVtId(''); setVtSo('1');
      await refreshAll();
    } else {
      setActError(r.error || 'Thêm vật liệu thất bại');
    }
    setMutating(false);
  };

  const doAction = async (fn: string, args?: any) => {
    setMutating(true);
    setActError(null);
    const r = await api.call(fn, args);
    if (r.ok) {
      setShowTuChoi(false);
      setLyDo('');
      await refreshAll();
    } else {
      setActError(r.error || 'Thao tác thất bại');
    }
    setMutating(false);
  };

  const cvList = actRows.filter((a) => a.hanh_dong === 'sc_them_cv');
  const vtList = actRows.filter((a) => a.hanh_dong === 'sc_them_vt');
  const showButtons = !!sc && sc.trang_thai !== 'tu_choi' && sc.trang_thai !== 'da_quyet';

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h3 className="text-lg font-semibold">Chi tiết SC: {id}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {errLocal && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {errLocal}
            </div>
          )}
          {actError && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {actError}
            </div>
          )}
          {(mutating || loading) && <Spinner />}

          {/* Header info */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold">Thông tin</h4>
            {loading ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                <table className="w-full text-xs"><tbody><SkeletonRow cols={4} /></tbody></table>
              </div>
            ) : sc ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Trạng thái:</span>{' '}
                  <StatusChip st={sc.trang_thai} />
                </div>
                <div>
                  <span className="text-slate-500">Ngày tạo:</span> {formatDate(sc.ngay_tao)}
                </div>
                <div>
                  <span className="text-slate-500">Xe:</span> {xeMap.get(sc.xe_id) ?? sc.xe_id}
                </div>
                <div>
                  <span className="text-slate-500">Tổng cộng:</span>{' '}
                  {money(sc.tong ?? sc.tong_cong ?? sc.tong_vt)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Chưa có chi tiết.</div>
            )}
          </section>

          {/* Hồ sơ 8 bước */}
          <section className="mb-5">
            <h4 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
              Hồ sơ 8 bước sửa chữa
              <button
                type="button"
                onClick={exportReport}
                disabled={!hs}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Xuất báo cáo
              </button>
              {canKehoach && (
                <button
                  type="button"
                  onClick={saveHoSo}
                  disabled={hsSaving}
                  className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  {hsSaving ? 'Đang lưu…' : 'Lưu hồ sơ'}
                </button>
              )}
            </h4>
            {hsLoading ? (
              <div className="text-sm text-slate-400">Đang kiểm tra hồ sơ…</div>
            ) : hs == null ? (
              <div className="text-sm text-slate-400">Không tải được hồ sơ.</div>
            ) : (
              <>
                <div
                  className={
                    'mb-2 rounded border px-3 py-2 text-sm ' +
                    (hs.ok
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800')
                  }
                >
                  {hs.ok ? '✅ Hồ sơ đầy đủ — có thể quyết toán.' : '⚠️ Thiếu: ' + hs.miss.join(', ')}
                </div>
                <ol className="space-y-1">
                  {hs.steps.map((s) => (
                    <li
                      key={s.step}
                      className="flex items-center gap-2 rounded border border-slate-100 px-3 py-1.5 text-sm"
                    >
                      <span
                        className={
                          'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ' +
                          (s.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                        }
                      >
                        {s.ok ? '✓' : '✕'}
                      </span>
                      <span className="flex-1">
                        {s.step}. {s.label}
                      </span>
                      {s.note && <span className="text-xs text-slate-400">{s.note}</span>}
                      {s.link && (
                        <button
                          type="button"
                          onClick={() => gotoStep(s)}
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50"
                        >
                          Đi tới
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
                {/* Forms nhập hồ sơ 8 bước */}
                {canSua && (
                  <div id="kh-form" className="mt-3 rounded border border-slate-200 p-3">
                    <div className="mb-1 text-xs font-semibold text-slate-600">1 · Kế hoạch sửa chữa (mẫu 01)</div>
                    <textarea
                      value={khText}
                      onChange={(e) => setKhText(e.target.value)}
                      rows={2}
                      placeholder="Mô tả kế hoạch sửa chữa…"
                      className="block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={saveKh}
                        disabled={mutating || !khText.trim()}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Lưu kế hoạch
                      </button>
                    </div>
                  </div>
                )}
                {canSua && (
                  <div id="kt-form" className="mt-3 rounded border border-slate-200 p-3">
                    <div className="mb-1 text-xs font-semibold text-slate-600">2 · Bản kiểm tu</div>
                    <textarea
                      value={ktText}
                      onChange={(e) => setKtText(e.target.value)}
                      rows={2}
                      placeholder="Mô tả kiểm tu / vật tư cần thay thế…"
                      className="block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={saveKt}
                        disabled={mutating || !ktText.trim()}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Lưu kiểm tu
                      </button>
                    </div>
                  </div>
                )}
                {canKehoach && (
                  <div id="nn-form" className="mt-3 rounded border border-slate-200 p-3">
                    <div className="mb-1 text-xs font-semibold text-slate-600">7 · Biên bản nghiệm thu</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="block text-xs text-slate-500">Ngày</label>
                        <input
                          type="date"
                          value={nnNgay}
                          onChange={(e) => setNnNgay(e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500">Tổng vật tư</label>
                        <input
                          type="number"
                          min={0}
                          value={nnVt}
                          onChange={(e) => setNnVt(e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500">Tổng nhân công</label>
                        <input
                          type="number"
                          min={0}
                          value={nnNc}
                          onChange={(e) => setNnNc(e.target.value)}
                          className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={saveNn}
                        disabled={mutating}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Lưu nghiệm thu
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Activity */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold">Hoạt động</h4>
            {actLoading ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                <table className="w-full text-xs"><tbody><SkeletonRow cols={4} /></tbody></table>
              </div>
            ) : actRows.length === 0 ? (
              <div className="text-sm text-slate-400">Chưa có hoạt động.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-medium text-slate-600">
                      <th className="px-3 py-2">Thời gian</th>
                      <th className="px-3 py-2">Người</th>
                      <th className="px-3 py-2">Hành động</th>
                      <th className="px-3 py-2">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actRows.map((a, i) => (
                      <tr key={(a.id ?? a.ts) + i} className="border-t border-slate-100 last:border-0">
                        <td className="px-3 py-1.5 text-slate-500">{formatDate(a.ts)}</td>
                        <td className="px-3 py-1.5">{a.actor_role || a.actor_id || '—'}</td>
                        <td className="px-3 py-1.5">{a.hanh_dong}</td>
                        <td className="px-3 py-1.5 text-slate-600">{a.mo_ta || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Công việc */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold">Công việc</h4>
            {canSua ? (
              <form onSubmit={doCv} className="mb-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mô tả *</label>
                  <input
                    type="text"
                    required
                    value={cvMo}
                    onChange={(e) => setCvMo(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nguyên nhân</label>
                  <input
                    type="text"
                    value={cvNguyenNhan}
                    onChange={(e) => setCvNguyenNhan(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Loại xử lý</label>
                  <select
                    value={cvLoai}
                    onChange={(e) => setCvLoai(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {Object.entries(LOAI_XU_LY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Số lượng</label>
                    <input
                      type="number"
                      min={1}
                      value={cvSo}
                      onChange={(e) => setCvSo(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Đơn giá</label>
                    <input
                      type="number"
                      min={0}
                      value={cvDon}
                      onChange={(e) => setCvDon(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={mutating || api.loading}
                    className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {mutating ? 'Đang thêm…' : 'Thêm công việc'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-2 text-sm text-slate-400">Bạn không có quyền thêm công việc.</div>
            )}

            {cvList.length === 0 ? (
              <div className="text-sm text-slate-400">Chưa có công việc.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-medium text-slate-600">
                      <th className="px-3 py-1">Thời gian</th>
                      <th className="px-3 py-1">Người</th>
                      <th className="px-3 py-1">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cvList.map((a, i) => (
                      <tr key={(a.id ?? a.ts) + i} className="border-t border-slate-100 last:border-0">
                        <td className="px-3 py-1 text-slate-500">{formatDate(a.ts)}</td>
                        <td className="px-3 py-1">{a.actor_role || a.actor_id || '—'}</td>
                        <td className="px-3 py-1 text-slate-600">{a.mo_ta || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Vật liệu */}
          <section className="mb-5">
            <h4 className="mb-2 text-sm font-semibold">Vật liệu</h4>
            {canSua ? (
              <form onSubmit={doVt} className="mb-3 grid grid-cols-3 gap-3 text-sm items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Vật tư *</label>
                  <select
                    required
                    value={vtId}
                    onChange={(e) => setVtId(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">— chọn vật tư —</option>
                    {vattuList.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.ten} ({Number(v.ton ?? 0).toLocaleString('vi-VN')} {v.don_vi})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Số lượng</label>
                  <input
                    type="number"
                    min={1}
                    value={vtSo}
                    onChange={(e) => setVtSo(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={mutating || api.loading || vattuList.length === 0}
                    className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {mutating ? 'Đang thêm…' : 'Thêm vật tư'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-2 text-sm text-slate-400">Bạn không có quyền thêm vật tư.</div>
            )}

            {vtList.length === 0 ? (
              <div className="text-sm text-slate-400">Chưa có vật liệu.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left font-medium text-slate-600">
                      <th className="px-3 py-1">Thời gian</th>
                      <th className="px-3 py-1">Người</th>
                      <th className="px-3 py-1">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vtList.map((a, i) => (
                      <tr key={(a.id ?? a.ts) + i} className="border-t border-slate-100 last:border-0">
                        <td className="px-3 py-1 text-slate-500">{formatDate(a.ts)}</td>
                        <td className="px-3 py-1">{a.actor_role || a.actor_id || '—'}</td>
                        <td className="px-3 py-1 text-slate-600">{a.mo_ta || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Status actions */}
          {showButtons && (
            <section className="mb-2 flex flex-wrap gap-2 pt-2">
              {sc.trang_thai === 'de_xuat' && canSua && (
                <button
                  type="button"
                  onClick={() => doAction('scBatDauSua', { sc_id: id })}
                  disabled={mutating || api.loading}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Bắt đầu sửa
                </button>
              )}
              {sc.trang_thai === 'dang_sua' && canSua && (
                <button
                  type="button"
                  onClick={() => doAction('scHoanThanh', { sc_id: id })}
                  disabled={mutating || api.loading}
                  className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Hoàn thành
                </button>
              )}
              {(sc.trang_thai === 'de_xuat' || sc.trang_thai === 'dang_sua') && canSua && (
                <button
                  type="button"
                  onClick={() => setShowTuChoi(true)}
                  disabled={mutating || api.loading}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Từ chối
                </button>
              )}
                {sc.trang_thai === 'da_hoan' && canKehoach && (
                  <button
                    type="button"
                    onClick={() => doAction('scQuyetToan', { sc_id: id })}
                    disabled={mutating || api.loading || (hs ? !hs.ok : false)}
                    title={hs && !hs.ok ? 'Thiếu hồ sơ: ' + hs.miss.join(', ') : undefined}
                    className="rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    Quyết toán
                  </button>
                )}
            </section>
          )}

          {showTuChoi && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
              <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
                <h4 className="mb-3 text-sm font-semibold">Lý do từ chối</h4>
                <textarea
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                  rows={3}
                  className="block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Nhập lý do từ chối…"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTuChoi(false)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => doAction('scTuChoi', { sc_id: id, ly_do: lyDo.trim() })}
                    disabled={mutating || api.loading || !lyDo.trim()}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Xác nhận từ chối
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScPage() {
  const router = useRouter();
  const api = useApi();
  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  const [xeList, setXeList] = useState<XeRow[]>([]);
  const [xeMap, setXeMap] = useState<Map<string, string>>(new Map());
  const [vattuList, setVattuList] = useState<VattuRow[]>([]);
  const [scList, setScList] = useState<ScRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [xeSelected, setXeSelected] = useState('');
  const [ngay, setNgay] = useState(todayStr);

  const loadXe = useCallback(async () => {
    const r = await api.call('xeList');
    if (r.ok) {
      const xs = (r.result as XeRow[]) ?? [];
      setXeList(xs);
      const m = new Map<string, string>();
      for (const x of xs) m.set(x.id, x.bien_so);
      setXeMap(m);
    }
  }, [api]);

  const loadVattu = useCallback(async () => {
    const r = await api.call('vattuList');
    if (r.ok) setVattuList((r.result as VattuRow[]) ?? []);
  }, [api]);

  const refreshSc = useCallback(async () => {
    setScList(null);
    setErr(null);
    const r = await api.call('scList');
    if (r.ok) setScList((r.result as ScRow[]) ?? []);
    else {
      setScList([]);
      setErr(r.error || 'Không tải được danh sách SC');
    }
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
      loadXe();
      loadVattu();
      refreshSc();
    });
    return () => {
      active = false;
    };
  }, [router, loadXe, loadVattu, refreshSc]);

  const handleCreate = async () => {
    if (!xeSelected || !ngay) return;
    setCreating(true);
    setErr(null);
    const r = await api.call('scCreate', { xe_id: xeSelected, ngay });
    if (r.ok) {
      setXeSelected('');
      setNgay(todayStr);
      refreshSc();
    } else {
      setErr(r.error || 'Tạo phiếu sửa chữa thất bại');
    }
    setCreating(false);
  };

  const [modalId, setModalId] = useState<string | null>(null);
  const openModal = (id: string) => setModalId(id);
  const closeModal = () => setModalId(null);
  const onDone = useCallback(() => {
    refreshSc();
  }, [refreshSc]);

  const canCreate = user?.role === 'xuong' || user?.role === 'admin';
  const canSua = user?.role === 'xuong' || user?.role === 'admin';
  const canKehoach =
    user?.role === 'xuong' || user?.role === 'ketoan' || user?.role === 'admin';

  if (user === undefined || user === null) return <Spinner />;

  return (
    <div className="min-h-[50vh]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý sửa chữa</h1>
        <button
          type="button"
          onClick={refreshSc}
          disabled={api.loading}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Làm mới
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}

      {/* Form tạo SC */}
      {canCreate && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Tạo phiếu sửa chữa</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700">Xe *</label>
              <select
                value={xeSelected}
                onChange={(e) => setXeSelected(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                disabled={creating || xeList.length === 0}
              >
                <option value="">— chọn xe —</option>
                {xeList.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.bien_so} — {x.chu_xe || ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Ngày</label>
              <input
                type="date"
                value={ngay}
                onChange={(e) => setNgay(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                disabled={creating}
              />
            </div>
            <div className="md:col-span-2" />
            <div className="md:col-start-4">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !xeSelected}
                className="w-full rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Đang tạo…' : 'Tạo SC'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bảng SC */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Phiếu sửa chữa</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Mã SC</th>
                <th className="px-3 py-2">Xe</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Ngày tạo</th>
                <th className="px-3 py-2 text-right">Tổng cộng</th>
                <th className="px-3 py-2 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {scList === null ? (
                <SkeletonRow cols={6} />
              ) : scList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Chưa có phiếu sửa chữa.
                  </td>
                </tr>
              ) : (
                scList.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono">{s.id}</td>
                    <td className="px-3 py-2">{xeMap.get(s.xe_id) ?? s.xe_id}</td>
                    <td className="px-3 py-2">
                      <StatusChip st={s.trang_thai} />
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(s.ngay_tao)}</td>
                    <td className="px-3 py-2 text-right">{money(s.tong ?? s.tong_cong ?? s.tong_vt)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openModal(s.id)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
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

      {modalId && (
        <ScDetailModal
          id={modalId}
          open={true}
          onClose={closeModal}
          onDone={onDone}
          xeMap={xeMap}
          vattuList={vattuList}
          canSua={canSua}
          canKehoach={canKehoach}
        />
      )}
    </div>
  );
}
