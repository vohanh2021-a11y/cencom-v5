'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { ttLabel } from '@/lib/sc-labels';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';

type ScGetResult = {
  sc: Record<string, any>;
  cong: Record<string, any>[];
  vat: Record<string, any>[];
  nguoi_lap_name?: string;
  nguoi_duyet_name?: string;
  xe?: { bks: string; hang: string; dong: string } | null;
  canApprove?: boolean;
  canTongDuyet?: boolean;
  canEdit?: boolean;
};

const CV_TT: Record<string, string> = { todo: 'Chưa làm', dang: 'Đang làm', hoan: 'Hoàn thành' };

export default function ScDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const toast = useToast();
  const { perms } = useSession();

  const { data, loading, error, refetch } = useRpc<ScGetResult>('scGet', [id]);
  const refetchRef = React.useRef(refetch);
  refetchRef.current = refetch;

  // Realtime: phiếu thay đổi → tải lại
  useRealtime('sc', () => refetchRef.current && refetchRef.current());

  const [busy, setBusy] = React.useState(false);
  const [reject, setReject] = React.useState<{ kind: 'appr' | 'tong'; open: boolean }>({ kind: 'appr', open: false });
  const [lyDo, setLyDo] = React.useState('');

  const sc = data?.sc;
  const tt = sc?.trang_thai as string | undefined;
  const cong = data?.cong || [];
  const vat = data?.vat || [];

  const canSua = !!perms?.['sc']?.includes('sua');
  const canNghiem = !!perms?.['sc']?.includes('nghiem');

  async function act(fn: string, args: unknown[], okMsg: string) {
    setBusy(true);
    try {
      const r = await rpc(fn, args);
      if (r.ok) {
        toast(okMsg, 'ok');
        refetch();
      } else {
        toast(r.error || 'Thao tác thất bại', 'err');
      }
    } catch (e) {
      toast('Lỗi mạng', 'err');
    } finally {
      setBusy(false);
    }
  }

  function doApprove(action: 'ok' | 'no') {
    if (action === 'no') {
      setReject({ kind: 'appr', open: true });
      return;
    }
    act('scApprove', [id, 'ok', lyDo], 'Đã duyệt phiếu');
  }
  function doTongDuyet(action: 'ok' | 'no') {
    if (action === 'no') {
      setReject({ kind: 'tong', open: true });
      return;
    }
    act('scTongDuyet', [id, 'ok', lyDo], 'Đã tổng duyệt');
  }
  function confirmReject() {
    const fn = reject.kind === 'appr' ? 'scApprove' : 'scTongDuyet';
    act(fn, [id, 'no', lyDo], 'Đã từ chối');
    setReject({ kind: 'appr', open: false });
    setLyDo('');
  }

  if (loading) return <div className="p-6 text-[var(--c-muted)]">Đang tải phiếu…</div>;
  if (error) return <div className="p-6 text-[var(--c-danger)]">Lỗi: {error}</div>;
  if (!sc) return <div className="p-6 text-[var(--c-muted)]">Không tìm thấy phiếu.</div>;

  const showApprove = tt === 'de_xuat' && (data?.canApprove ?? !!perms?.['sc']?.includes('duy'));
  const showTong = tt === 'da_duyet' && (data?.canTongDuyet ?? !!perms?.['sc']?.includes('duy'));
  const showStart = (tt === 'da_duyet' || tt === 'da_tong_duyet') && canSua;
  const showFinish = tt === 'dang_sua' && canSua;
  const showNghiem = tt === 'cho_nghiem' && canNghiem;

  return (
    <div className="page">
      <div className="page-head flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/sc" className="text-[var(--c-accent)] text-sm">← Quay lại danh sách</Link>
          <h1 className="text-xl font-semibold mt-1">
            Phiếu {sc.id} · {sc.bks}
          </h1>
          <div className="muted">
            {ttLabel(tt)} · {sc.loai_xu_ly || 'Sửa chữa'} · {data?.nguoi_lap_name || sc.nguoi_lap}
          </div>
        </div>
        <span className="badge sm" data-tt={tt}>{ttLabel(tt)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="card-h">Thông tin chung</div>
          <div className="card-b space-y-2">
            <Row label="Biển số" value={sc.bks} />
            <Row label="Mô tả" value={sc.mo_ta || '—'} />
            <Row label="Người lập" value={data?.nguoi_lap_name || sc.nguoi_lap || '—'} />
            <Row label="Ngày lập" value={sc.ngay_lap || '—'} />
            <Row label="Hạn trả xe" value={sc.ngay_du_kien || '—'} />
            <Row label="Tổng chi phí" value={fmtMoney(Number(sc.tong) || 0)} />
            <Row label="Ghi chú" value={sc.ghi_chu || '—'} />
          </div>
        </div>

        <div className="card">
          <div className="card-h">Công việc ({cong.length})</div>
          <div className="card-b p-0">
            <table className="tbl">
              <thead>
                <tr><th>Tên</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Thành</th><th>Trạng thái</th></tr>
              </thead>
              <tbody>
                {cong.map((c, i) => (
                  <tr key={c.id || i}>
                    <td>{c.ten || '—'}</td>
                    <td className="num">{c.so_luong || 0}</td>
                    <td className="num">{fmtMoney(Number(c.don_gia) || 0)}</td>
                    <td className="num">{fmtMoney((Number(c.so_luong) || 0) * (Number(c.don_gia) || 0))}</td>
                    <td>{CV_TT[c.tt as string] || c.tt || '—'}</td>
                  </tr>
                ))}
                {cong.length === 0 && (
                  <tr><td colSpan={5} className="muted text-center">Chưa có công việc</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-h">Vật tư ({vat.length})</div>
        <div className="card-b p-0">
          <table className="tbl">
            <thead>
              <tr><th>Tên</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Thành</th></tr>
            </thead>
            <tbody>
              {vat.map((v, i) => {
                const dg = Number(v.gd_tt) > 0 ? Number(v.gd_tt) : Number(v.gd_dk);
                return (
                  <tr key={v.id || i}>
                    <td>{v.ten || '—'}</td>
                    <td className="num">{v.so_luong || 0}</td>
                    <td className="num">{fmtMoney(dg || 0)}</td>
                    <td className="num">{fmtMoney((Number(v.so_luong) || 0) * (dg || 0))}</td>
                  </tr>
                );
              })}
              {vat.length === 0 && (
                <tr><td colSpan={4} className="muted text-center">Chưa có vật tư</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thanh hành động */}
      <div className="action-bar">
        {showApprove && (
          <>
            <Button onClick={() => doApprove('ok')} disabled={busy}>Duyệt</Button>
            <Button variant="danger" onClick={() => doApprove('no')} disabled={busy}>Từ chối</Button>
          </>
        )}
        {showTong && (
          <>
            <Button onClick={() => doTongDuyet('ok')} disabled={busy}>Tổng duyệt</Button>
            <Button variant="danger" onClick={() => doTongDuyet('no')} disabled={busy}>Từ chối tổng duyệt</Button>
          </>
        )}
        {showStart && (
          <Button variant="accent" onClick={() => act('scStart', [id], 'Đã bắt đầu sửa chữa')} disabled={busy}>Bắt đầu sửa</Button>
        )}
        {showFinish && (
          <Button variant="accent" onClick={() => act('scFinish', [id], 'Đã hoàn tất — chờ nghiệm thu')} disabled={busy}>Hoàn tất công việc</Button>
        )}
        {showNghiem && (
          <>
            <Button onClick={() => act('scNghiem', [id, true, ''], 'Nghiệm thu đạt')} disabled={busy}>Nghiệm thu đạt</Button>
            <Button variant="danger" onClick={() => act('scNghiem', [id, false, lyDo], 'Nghiệm thu không đạt')} disabled={busy}>Không đạt</Button>
          </>
        )}
        {!showApprove && !showTong && !showStart && !showFinish && !showNghiem && (
          <span className="muted">Phiếu ở trạng thái {ttLabel(tt)} — không có hành động khả dụng.</span>
        )}
      </div>

      {/* Form từ chối */}
      {reject.open && (
        <div className="modal-scrim" onClick={() => setReject({ kind: 'appr', open: false })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">Lý do từ chối</div>
            <div className="modal-b">
              <textarea
                className="input w-full"
                rows={3}
                value={lyDo}
                onChange={(e) => setLyDo(e.target.value)}
                placeholder="Nhập lý do…"
              />
            </div>
            <div className="modal-f flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReject({ kind: 'appr', open: false })}>Hủy</Button>
              <Button variant="danger" onClick={confirmReject} disabled={busy}>Xác nhận từ chối</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="muted w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
