'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, useApi, type RpcResult } from '@/lib/hooks/useApi';
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
  /** Lõi scList trả SELECT * — `ma`/`mo_ta` có thể absent; filter fallback id. */
  ma?: string | null;
  bien_so?: string | null;
  mo_ta?: string | null;
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
  // W3.5 (duyệt phân tầng v3.6 sc.js TT_LABEL dòng 13–19): de_xuat → Duyệt →
  // 'da_duyet' → Tổng duyệt (+snapshot chốt) → 'da_tong_duyet'. 2 nhãn addition
  // PHẢI khớp đúng giá trị enum core scApprove/scTongDuyet (worker-c);
  // StatusChip fallback render raw key nếu core đặt tên khác (không crash).
  da_duyet: 'Đã duyệt',
  da_tong_duyet: 'Đã tổng duyệt',
};

const STATUS_CHIP: Record<string, string> = {
  de_xuat: 'bg-amber-100 text-amber-800',
  dang_sua: 'bg-blue-100 text-blue-800',
  da_hoan: 'bg-green-100 text-green-800',
  tu_choi: 'bg-red-100 text-red-800',
  da_quyet: 'bg-purple-100 text-purple-800',
  da_duyet: 'bg-sky-100 text-sky-800',
  da_tong_duyet: 'bg-teal-100 text-teal-800',
};

const LOAI_XU_LY: Record<string, string> = {
  thay_moi: 'Thay mới',
  sua_chua: 'Sửa chữa',
  bao_duong: 'Bảo dưỡng',
  khac: 'Khác',
};

const _TT_LABEL: Record<string, string> = { // eslint-disable-line no-unused-vars
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

/**
 * W3.5 — fn CHƯA vào RPC registry (worker-c đang đăng ký scApprove/scTongDuyet
 * SONG SONG với task UI này) → dispatch throw 'Unknown fn' → HTTP 404.
 * Mirror NGUYÊN helper local của app/(app)/kho/dm/page.tsx:119 (W2b — cùng
 * bài toán graceful-skip); KHÔNG dedupe vào lib/** (task cấm sửa lib).
 */
function isFnUnavailable(res: RpcResult): boolean {
  if (res.ok) return false; // thành công RPC → fn có tồn tại
  if (res.status === 404) return true; // dispatch throw 'Unknown fn' → HTTP 404
  const e = String(res.error || '').toLowerCase();
  return e.includes('unknown fn') || e.includes('fn chưa khả dụng');
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
  // ── W3.5 · duyệt phân tầng (scApprove → scTongDuyet + chốt hồ sơ) ────────
  /** role thuộc tập duyệt v3.6 (admin/giamdoc) — CHỈ hint UI, phán quyết thật ở core. */
  canApprove: boolean;
  /** null = đang probe · true = scApprove đã đăng ký · false = 'Unknown fn'. */
  approveReady: boolean | null;
  /** probe registry cho scTongDuyet (cùng ý nghĩa). */
  tongDuyetReady: boolean | null;
  /** re-probe 2 fn sau khi một lần gọi vấp 'Unknown fn' (worker-c hot-register giữa phiên). */
  onRetryApproveProbe: () => void;
  /** toast transient render ở ScPage (confirm + toast + reload theo task). */
  // base rule `no-unused-vars` (ESLint core) không hiểu tham số trong signature
  // kiểu hàm TS — parser là @typescript-eslint nhưng flat config chưa gắn plugin
  // TS-aware. Tham số `msg` ở đây là DOCUMENTATION của hợp đồng prop (không có
  // body để 'dùng'), không phải code chết → suppress đúng 1 dòng, không đổi config.
  // eslint-disable-next-line no-unused-vars
  showToast: (msg: string) => void;
}

function ScDetailModal({
  id,
  open,
  onClose,
  onDone,
  xeMap,
  vattuList,
  canSua,
  canKehoach,
  canApprove,
  approveReady,
  tongDuyetReady,
  onRetryApproveProbe,
  showToast,
}: ModalProps) {
  const api = useApi();
  const [sc, setSc] = useState<ScDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actRows, setActRows] = useState<ActivityRow[]>([]);
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [showTuChoi, setShowTuChoi] = useState(false);
  const [lyDo, setLyDo] = useState('');
  // W3.5 · cờ chốt LẠC QUAN: scTongDuyet env {chot:true} trả về nhưng scGet v5
  // (SELECT * trần, CHƯA join sc_phien_ban) không expose flag → badge vẫn đúng
  // ngay trong phiên modal; hint server-side thật suy từ activity (dưới).
  const [chotLocal, setChotLocal] = useState(false);

  const [cvMo, setCvMo] = useState('');
  const [cvNguyenNhan, setCvNguyenNhan] = useState('');
  const [cvLoai, setCvLoai] = useState('thay_moi');
  const [cvSo, setCvSo] = useState('1');
  const [cvDon, setCvDon] = useState('0');

  const [vtId, setVtId] = useState('');
  const [vtSo, setVtSo] = useState('1');

  // ── W2.5 · 'Gán giá NCC' (chỉ khi SC ở trạng thái de_xuat) ──────────────
  // Bảng chọn 'Đơn giá: [giá lịch sử]' + danh sách 'top 8' kèm ncc/ngày,
  // nguồn RPC `giaLichSuList` (meta ['kho','xem']).
  //
  // ⚠️ LỊCH SỬ W2.5 → ĐÃ ĐÓNG GÓI Ở W3.3A (wire cuối W2.5-flag):
  //   `scAddVatTu` core (lib/core/sc.ts:201-241) NHẬN `don_gia` (alias cột v5
  //   `gd_dk`): gd_dk = p.gd_dk ?? p.don_gia ?? 0, clamp ≥ 0, INSERT vào
  //   `sc_vattu.gd_dk` — contract lib/contracts.ts cũng đã mở 2 key. Nên cờ
  //   bật TRUE: giá chọn từ top-8 `giaLichSuList` được gửi theo dòng VT.
  //   Hành vi có chủ đích: KHÔNG chọn giá → don_gia thiếu → gd_dk=0 ("dòng
  //   chưa giá", fixture W0.2 — không fallback vattu.gia như v3.6).
  const WIRESH_PRICE = true; // W2.5-flag: wire don_gia(=gd_dk) vào scAddVatTu
  // (giữ biến để bật/tắt nhanh nếu regression; dead-code `!WIRESH_PRICE` bên
  // dưới là hint tham khảo W2.5 — không render khi cờ true.)
  interface GiaRow {
    id: string;
    vattu_id: string;
    gia: number;
    ncc?: string | null;
    loai?: string | null;
    ngay?: string | null;
    phieu_id?: string | null;
  }
  const [giaRows, setGiaRows] = useState<GiaRow[]>([]);
  const [giaLoading, setGiaLoading] = useState(false);
  const [giaError, setGiaError] = useState<string | null>(null);
  const [giaChon, setGiaChon] = useState<GiaRow | null>(null);


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

  // W2.5 — fetch top-8 giá lịch sử của vật tư đang chọn, CHỈ khi SC de_xuat.
  // huỷ kết quả nếu người dùng đổi vtId giữa lúc đang fetch (race token).
  useEffect(() => {
    if (!open || sc?.trang_thai !== 'de_xuat' || !vtId) {
      setGiaRows([]);
      setGiaError(null);
      setGiaChon(null);
      return;
    }
    let active = true;
    setGiaLoading(true);
    setGiaError(null);
    setGiaChon(null);
    (async () => {
      // env lồng: dm/giaLichSu trả {ok:false,error} trong result, HTTP vẫn 200
      const r = await api.call('giaLichSuList', { vattu_id: vtId, limit: 8 });
      if (!active) return;
      if (r.ok) {
        const env = r.result as { ok: boolean; result?: GiaRow[]; error?: string };
        if (env && env.ok === false) {
          setGiaError(env.error || 'Không tải được lịch sử giá');
          setGiaRows([]);
        } else {
          setGiaRows((env?.result ?? []) as GiaRow[]);
        }
      } else {
        setGiaError(r.error || 'Không tải được lịch sử giá');
        setGiaRows([]);
      }
      setGiaLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, sc?.trang_thai, vtId, api]);

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
    // W2.5-flag: WIRESH_PRICE=true → gửi `don_gia` (alias gd_dk — W3.3A core
    // lib/core/sc.ts:219). Không chọn giá lịch sử → key absence → gd_dk=0.
    const args: { sc_id: string; vattu_id: string; so_luong: number; don_gia?: number } = {
      sc_id: id,
      vattu_id: vtId,
      so_luong: Number(vtSo),
    };
    if (WIRESH_PRICE && giaChon) args.don_gia = giaChon.gia;
    const r = await api.call('scAddVatTu', args);
    if (r.ok) {
      setVtId(''); setVtSo('1'); setGiaChon(null);
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

  /* ── W3.5 · Duyệt / Tổng duyệt (scApprove · scTongDuyet — core worker-c) ──
   * callApprove: một điểm xử lý cho CẢ HAI fn.
   *  - 'Unknown fn' (fn CHƯA vào registry — worker-c reg song song): KHÔNG crash,
   *    banner + re-probe qua onRetryApproveProbe (pattern W2b dm/page.tsx).
   *  - Lỗi nghiệp vụ 2 tầng: HTTP 400 (họ sc.ts cũ THROW) và envelope lồng
   *    {ok:false,error} trong result — scApprove/scTongDuyet bản chốt trả
   *    ENVELOPE 200+{ok:false} như dmDecide → cả hai đều hiện banner.
   *  - Thành công: toast + refreshAll (reload sc+activity+hồ sơ + danh sách);
   *    scTongDuyet success → setChotLocal (cờ chốt lạc quan — xem isChot dưới).
   * ARGS: CHỐT THEO CORE W3.5 (lib/core/sc.ts:932-995): { id } — KHÔNG có
   * 'action'/'quyet' (tổng duyệt chỉ một nhánh ok; từ chối = đường riêng
   * scTuChoi từ de_xuat, đúng v3.5-port comment sc.ts:806-809).
   */
  const callApprove = async (
    fn: 'scApprove' | 'scTongDuyet',
    args: Record<string, unknown>,
    okToast: string
  ): Promise<boolean> => {
    setMutating(true);
    setActError(null);
    const r = await api.call(fn, args);
    if (isFnUnavailable(r)) {
      setActError(
        `${fn} chưa khả dụng (W3.5 core đang đăng ký RPC song song) — đã tự thử lại, bấm lại nút sau ít giây.`
      );
      onRetryApproveProbe();
      setMutating(false);
      return false;
    }
    const env = (r.ok ? r.result : null) as { ok?: boolean; error?: string; chot?: boolean } | null;
    if (!r.ok || (env && env.ok === false)) {
      setActError((!r.ok ? r.error : env?.error) || 'Thao tác duyệt thất bại');
      setMutating(false);
      return false;
    }
    if (fn === 'scTongDuyet' || env?.chot === true) setChotLocal(true);
    showToast(okToast);
    await refreshAll();
    setMutating(false);
    return true;
  };

  const doApprove = () => {
    if (!sc) return;
    const tong = sc.tong ?? sc.tong_cong ?? sc.tong_vt ?? 0;
    if (!window.confirm(`Duyệt phiếu ${id} (tổng ${money(tong)})? Trạng thái → 'Đã duyệt'.`)) return;
    return callApprove('scApprove', { id }, `Đã duyệt ${id} → 'Đã duyệt'.`);
  };

  const doTongDuyet = () => {
    if (!sc) return;
    if (!window.confirm(`Tổng duyệt ${id}? Hành động này CHỐT hồ sơ (snapshot bất biến — v3.6 GĐ3.7), không rút lại được.`))
      return;
    return callApprove('scTongDuyet', { id }, `Đã tổng duyệt ${id} — hồ sơ đã chốt.`);
  };

  const cvList = actRows.filter((a) => a.hanh_dong === 'sc_them_cv');
  const vtList = actRows.filter((a) => a.hanh_dong === 'sc_them_vt');
  const showButtons = !!sc && sc.trang_thai !== 'tu_choi' && sc.trang_thai !== 'da_quyet';

  // ── W3.5 · chốt hồ sơ (snapshot sc_phien_ban) + khóa dòng VT/CV ──────────
  // Máy trạng thái v5 chốt theo worker-c (sc.ts:799-809): KHÔNG có
  // 'da_tong_duyet' — TỔNG DUYỆT = phiếu DỪNG 'da_duyet' + TỒN TẠI dòng
  // sc_phien_ban. Nguồn cờ chốt (dọc theo khả năng expose của core):
  //  1) field trực tiếp trên scGet nếu core thêm sau này: da_chot/chot/co_phien_ban;
  //  2) 'da_tong_duyet' — dead trong v5 hôm nay, giữ tương thích nhãn v3.6;
  //  3) chotLocal — env {chot:true} của chính lần tổng duyệt trong phiên modal;
  //  4) activity feed: audit 'sc_tong_duyet' (sc.ts:1019) hoặc auto-chot của
  //     scBatDauSua (sc.ts:307 mo_ta 'Bắt đầu sửa (tự chốt phiên bản…)').
  const tt = sc?.trang_thai ?? '';
  const anySc = sc as (ScDetail & { da_chot?: unknown; chot?: unknown; co_phien_ban?: unknown }) | null;
  const rawChot = anySc?.da_chot ?? anySc?.chot ?? anySc?.co_phien_ban;
  const actChot = actRows.some(
    (a) =>
      a.hanh_dong === 'sc_tong_duyet' ||
      (a.hanh_dong === 'sc_bat_dau_sua' && /tự chốt/i.test(String(a.mo_ta ?? '')))
  );
  const isChot =
    !!sc && (rawChot === true || rawChot === 1 || rawChot === '1' || tt === 'da_tong_duyet' || chotLocal || actChot);
  // v3.6: dòng CV/VT chỉ SỬA được khi de_xuat (scWorkSet/scVtAdd gate de_xuat —
  // FN_LIST W3.3A ghi rõ). da_duyet/da_tong_duyet/chot → DISABLE input + hint
  // (KHÔNG ẩn block — user vẫn xem được form, theo chỉ đạo task W3.5-UI).
  const linesLocked = !!sc && (isChot || tt !== 'de_xuat');
  const lockHint = isChot
    ? '🔒 Hồ sơ đã chốt (snapshot) — không thêm/sửa dòng công việc/vật tư.'
    : 'Chỉ thêm/sửa dòng công việc, vật tư khi phiếu ở trạng thái Đề xuất (v3.6).';

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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500">Trạng thái:</span>
                  <StatusChip st={sc.trang_thai} />
                  {/* W3.5 · badge chốt hồ sơ — có snapshot sc_phien_ban (v3.6 GĐ3.7) */}
                  {isChot && (
                    <span
                      data-testid="sc-chot-badge"
                      className="inline-flex items-center gap-1 rounded bg-teal-700 px-2 py-0.5 text-xs font-medium text-white"
                    >
                      🔒 Đã chốt hồ sơ
                    </span>
                  )}
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
            {canSua && linesLocked && (
              <div
                data-testid="sc-edit-lock-hint"
                className="mb-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500"
              >
                {lockHint}
              </div>
            )}
            {canSua ? (
              <form onSubmit={doCv} className="mb-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mô tả *</label>
                  <input
                    type="text"
                    required
                    disabled={linesLocked}
                    value={cvMo}
                    onChange={(e) => setCvMo(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nguyên nhân</label>
                  <input
                    type="text"
                    disabled={linesLocked}
                    value={cvNguyenNhan}
                    onChange={(e) => setCvNguyenNhan(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Loại xử lý</label>
                  <select
                    value={cvLoai}
                    disabled={linesLocked}
                    onChange={(e) => setCvLoai(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
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
                      disabled={linesLocked}
                      value={cvSo}
                      onChange={(e) => setCvSo(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Đơn giá</label>
                    <input
                      type="number"
                      min={0}
                      disabled={linesLocked}
                      value={cvDon}
                      onChange={(e) => setCvDon(e.target.value)}
                      className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    type="submit"
                    data-testid="sc-cv-submit"
                    disabled={mutating || api.loading || linesLocked}
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
            {canSua && linesLocked && (
              <div
                data-testid="sc-edit-lock-hint"
                className="mb-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500"
              >
                {lockHint}
              </div>
            )}
            {canSua ? (
              <form onSubmit={doVt} className="mb-3 grid grid-cols-3 gap-3 text-sm items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Vật tư *</label>
                  <select
                    required
                    data-testid="sc-vt-select"
                    disabled={linesLocked}
                    value={vtId}
                    onChange={(e) => setVtId(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
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
                    data-testid="sc-vt-soluong"
                    disabled={linesLocked}
                    value={vtSo}
                    onChange={(e) => setVtSo(e.target.value)}
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    data-testid="sc-vt-submit"
                    disabled={mutating || api.loading || vattuList.length === 0 || linesLocked}
                    className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {mutating ? 'Đang thêm…' : 'Thêm vật tư'}
                  </button>
                </div>
                {/* W2.5 · 'Gán giá NCC' — chỉ khi SC ở trạng thái de_xuat */}
                {sc?.trang_thai === 'de_xuat' && (
                  <div
                    data-testid="sc-gia-ncc"
                    className="col-span-3 rounded border border-slate-200 bg-slate-50 p-2 text-xs"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Gán giá NCC (lịch sử)</span>
                      {!WIRESH_PRICE && (
                        <span className="text-[11px] text-amber-700">
                          Hiển thị tham khảo · gán giá sẽ ở W3.4
                        </span>
                      )}
                    </div>
                    {!vtId ? (
                      <div className="text-slate-400">Chọn vật tư để xem lịch sử giá.</div>
                    ) : giaLoading ? (
                      <div className="text-slate-400">Đang tải lịch sử giá…</div>
                    ) : giaError ? (
                      <div className="text-red-600">{giaError}</div>
                    ) : giaRows.length === 0 ? (
                      <div className="text-slate-400">Chưa có lịch sử giá cho vật tư này.</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-500">Đơn giá</label>
                          <select
                            data-testid="sc-gia-ncc-select"
                            value={giaChon ? giaChon.id : ''}
                            onChange={(ev) => {
                              const hit = giaRows.find((g) => g.id === ev.target.value) ?? null;
                              setGiaChon(hit);
                              // WIRESH_PRICE=true (W2.5-flag): selection này được
                              // doVt gửi đi dạng `args.don_gia` → core ghi gd_dk.
                            }}
                            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="">— chọn giá lịch sử —</option>
                            {giaRows.map((g, i) => (
                              <option key={g.id} value={g.id}>
                                {money(g.gia)}
                                {g.ncc ? ` · ${g.ncc}` : ''} · {g.ngay || ''}
                                {i === 0 ? ' (mới nhất)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-slate-500">Top {giaRows.length} giá gần nhất</div>
                          <ul
                            data-testid="sc-gia-ncc-list"
                            className="mt-1 max-h-28 overflow-y-auto rounded border border-slate-200 bg-white"
                          >
                            {giaRows.map((g) => (
                              <li key={g.id} className="border-b border-slate-100 px-2 py-1 last:border-0">
                                <button
                                  type="button"
                                  onClick={() => setGiaChon(g)}
                                  className={
                                    'w-full text-left ' +
                                    (giaChon?.id === g.id ? 'font-semibold text-indigo-700' : 'text-slate-700 hover:bg-slate-50')
                                  }
                                >
                                  {money(g.gia)}
                                  <span className="ml-1 text-slate-400">
                                    · {g.ncc || 'NCC ?'} · {g.ngay || '—'}
                                    {g.loai ? ` · ${g.loai}` : ''}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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

          {/* Status actions — W3.5 máy trạng thái v3.6 (thêm nhánh duyệt/tổng duyệt) */}
          {showButtons && (
            <section className="mb-2 flex flex-wrap gap-2 pt-2" data-testid="sc-actions">
              {/* Bắt đầu sửa: de_xuat (đường tương-thích-v5 core vẫn giữ —
                  sc.ts:255-259, siết ở W3.6 nếu coordinator quyết) +
                  da_duyet (v3.6 scStart; core CHỈ gate theo trang_thai —
                  da_duyet đã chốt vẫn hợp lệ vì snapshot tồn tại, không ghi trùng
                  sc.ts:284-294). */}
              {canSua && (tt === 'de_xuat' || tt === 'da_duyet' || tt === 'da_tong_duyet') && (
                  <button
                    type="button"
                    data-testid="sc-start-btn"
                    onClick={() => doAction('scBatDauSua', { sc_id: id })}
                    disabled={mutating || api.loading}
                    title={tt !== 'de_xuat' ? 'Sẽ tự chốt hồ sơ (snapshot) trước khi sửa — v3.6' : undefined}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Bắt đầu sửa
                  </button>
                )}
              {/* W3.5 · Duyệt: de_xuat + role duyệt (fallback admin/giamdoc —
                  core scApprove vẫn enforce 'sc'.'duy' + ngưỡng duyet_sc_nguong).
                  Disable khi probe biết fn chưa reg ('Unknown fn' — worker-c). */}
              {tt === 'de_xuat' && canApprove && (
                <button
                  type="button"
                  data-testid="sc-approve-btn"
                  onClick={doApprove}
                  disabled={mutating || api.loading || approveReady !== true}
                  title={
                    approveReady === null
                      ? 'Đang kiểm tra scApprove…'
                      : approveReady === false
                        ? 'scApprove chưa khả dụng (W3.5 core đang đăng ký song song)'
                        : `Duyệt phiếu (tổng ${money(sc.tong ?? sc.tong_cong ?? sc.tong_vt ?? 0)})`
                  }
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Duyệt
                </button>
              )}
              {/* W3.5 · Tổng duyệt: sau 'da_duyet' VÀ chưa chốt; thành công →
                  badge 'Đã chốt hồ sơ' (snapshot + trạng thái da_tong_duyet). */}
              {tt === 'da_duyet' && !isChot && canApprove && (
                <button
                  type="button"
                  data-testid="sc-tongduyet-btn"
                  onClick={doTongDuyet}
                  disabled={mutating || api.loading || tongDuyetReady !== true}
                  title={
                    tongDuyetReady === null
                      ? 'Đang kiểm tra scTongDuyet…'
                      : tongDuyetReady === false
                        ? 'scTongDuyet chưa khả dụng (W3.5 core đang đăng ký song song)'
                        : 'Tổng duyệt lần cuối — chốt hồ sơ bất biến'
                  }
                  className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  Tổng duyệt
                </button>
              )}
              {tt === 'dang_sua' && canSua && (
                <button
                  type="button"
                  data-testid="sc-finish-btn"
                  onClick={() => doAction('scHoanThanh', { sc_id: id })}
                  disabled={mutating || api.loading}
                  className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Hoàn thành
                </button>
              )}
              {(tt === 'de_xuat' || tt === 'dang_sua') && canSua && (
                <button
                  type="button"
                  onClick={() => setShowTuChoi(true)}
                  disabled={mutating || api.loading}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Từ chối
                </button>
              )}
              {tt === 'da_hoan' && canKehoach && (
                <button
                  type="button"
                  data-testid="sc-quyettoan-btn"
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

export default function ScPage({ initialId = null }: { initialId?: string | null } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lọc theo URL ?q= — giữ nguyên văn để hiển thị, so khớp lowercase (khóa
  // tiếng Việt: so sánh substring thường, không normalize NFD — hành vi
  // nhất quán với ILIKE của globalSearch core).
  const qRaw = searchParams.get('q') ?? '';
  const q = qRaw.trim().toLowerCase();
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

  // W4-reg: initialId — deep-link /sc/<mã> từ GlobalSearch mount: modal mở
  // ngay khi list sẵn sàn; closeModal quay về /sc (URL không giữ mã stale).
  const [modalId, setModalId] = useState<string | null>(initialId);
  const openModal = (id: string) => setModalId(id);
  const closeModal = () => {
    setModalId(null);
    if (initialId) router.replace('/sc');
  };
  const onDone = useCallback(() => {
    refreshSc();
  }, [refreshSc]);

  /* ── W3.5 · probe registry scApprove/scTongDuyet (worker-c đăng ký SONG SONG) ─
   * Gọi {} — chưa reg → dispatch throw 'Unknown fn' → 404 (isFnUnavailable).
   * Đã reg → 400 core-validate 'sc_id' hoặc envelope {ok:false} — KHÔNG 404
   * ⇒ available. Probe lại mỗi lần mở modal + sau mỗi lần bấm vấp 'Unknown fn'
   * (next dev hot-reload: core vừa reg là nút sáng lại không cần tải lại trang).
   */
  const [approveReady, setApproveReady] = useState<boolean | null>(null);
  const [tongDuyetReady, setTongDuyetReady] = useState<boolean | null>(null);
  const probingRef = useRef(false);
  const probeApproveFns = useCallback(async () => {
    if (probingRef.current) return; // chống chồng 2 lượt probe (modal open + retry)
    probingRef.current = true;
    try {
      const rA = await api.call('scApprove', {});
      setApproveReady(!isFnUnavailable(rA));
      const rT = await api.call('scTongDuyet', {});
      setTongDuyetReady(!isFnUnavailable(rT));
    } finally {
      probingRef.current = false;
    }
  }, [api]);

  // toast transient 4s (confirm + toast + reload theo task W3.5)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 4000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current); // không hẹn giờ rò khi unmount
    },
    []
  );

  // probe sau khi có user (RPC cần cookie session) và mỗi lần modal mở
  useEffect(() => {
    if (user) void probeApproveFns();
  }, [user, probeApproveFns]);
  useEffect(() => {
    // deps ĐẦY ĐỦ theo hợp đồng hook: `user` (RPC cần cookie session) và
    // `probeApproveFns` là stable-identity (api cố định nhờ useRef trong
    // useApi.ts:28-34 + call useCallback []) → chỉ đổi khi hàm reg thật,
    // không gây re-probe loop. probingRef bên trong chặn chồng 2 lượt.
    if (modalId && user) void probeApproveFns();
  }, [modalId, user, probeApproveFns]);

  const canCreate = user?.role === 'xuong' || user?.role === 'admin';
  const canSua = user?.role === 'xuong' || user?.role === 'admin';
  const canKehoach =
    user?.role === 'xuong' || user?.role === 'ketoan' || user?.role === 'admin';
  /* W3.5 · quyền DUYỆT ở tầng UI — fallback theo chỉ đạo task: admin/giamdoc.
   * lib/perm.ts W3.5-REG hiện ĐÃ có MATRIX ['sc','duy'] = giamdoc + XUONG
   * (nhánh NGƯỠNG duyet_sc_nguong thay vai 'quanly' v3.6; admin bypass
   * can() dòng 20). UI CÓ Ý không hiện nút cho xuong: ngưỡng là giá trị
   * runtime phía server (client không đọc được config) — để nút sáng rồi ăn
   * business-error 'cần Giám đốc' rối hơn là ẩn. Phán quyết thật 2 lớp:
   * dispatch META ['sc','duy'] + core canApproveSC (fail-closed).
   * TODO(W3.6): nếu cần nút duyệt cho xuong-trong-ngưỡng, expose
   * duyet_sc_nguong qua appInfo/RPC rồi suy canDuyet = duy && tong<=nguong. */
  const canApprove = user?.role === 'admin' || user?.role === 'giamdoc';

  // ?q= lọc phía client trên chính trang /sc: ma (fallback id) · bien_so
  // (row hoặc suy từ xeMap) · mo_ta (absent với scList v5 → chuỗi rỗng).
  const filteredSc = useMemo(() => {
    if (scList === null) return null;
    if (!q) return scList;
    return scList.filter((s) => {
      const ma = String(s.ma ?? s.id ?? '').toLowerCase();
      const bienSo = String(s.bien_so ?? xeMap.get(s.xe_id) ?? s.xe_id ?? '').toLowerCase();
      const moTa = String(s.mo_ta ?? '').toLowerCase();
      return ma.includes(q) || bienSo.includes(q) || moTa.includes(q);
    });
  }, [scList, xeMap, q]);

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
        {q && (
          <p className="mb-2 text-xs text-slate-500">Kết quả cho: {qRaw}</p>
        )}
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
              {filteredSc === null ? (
                <SkeletonRow cols={6} />
              ) : filteredSc.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    {q ? 'Không có phiếu khớp bộ lọc.' : 'Chưa có phiếu sửa chữa.'}
                  </td>
                </tr>
              ) : (
                filteredSc.map((s) => (
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
          canApprove={canApprove}
          approveReady={approveReady}
          tongDuyetReady={tongDuyetReady}
          onRetryApproveProbe={() => void probeApproveFns()}
          showToast={showToast}
        />
      )}

      {/* toast transient (W3.5) — render TRÊN modal (z-70 > overlay z-50/60) */}
      {toast && (
        <div
          data-testid="sc-toast"
          role="status"
          className="fixed bottom-6 right-6 z-[70] max-w-sm rounded-lg bg-slate-800 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
