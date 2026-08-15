'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';

type XeRow = {
  bks: string;
  hang: string;
  dong: string;
  nam_sx: string | number;
  phong_ban: string;
  trang_thai: string;
  nguyen_gia: number;
  khau_hao: number;
  so_lan_sua: number;
  chi_phi_tich_luy: number;
  gttv: number;
};
type Report = { rows: XeRow[]; tong: Record<string, number> };
type XeDetail = {
  xe: { bks: string; hang: string; dong: string; nam_sx: string | number; lai_xe: string; phong_ban: string; trang_thai: string };
  nguyen_gia: number;
  khau_hao_nam: number;
  khau_hao: number;
  so_lan_sua: number;
  chi_phi_tich_luy: number;
  gttv: number;
};
type LichRow = { id: string; sc_id: string; bks: string; ngay: string; tong: number; nguoi: string; ghi_chu: string };

export default function AssetPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canXem = !!perms?.['asset']?.includes('xem');
  const canQuyet = !!perms?.['asset']?.includes('quyet');

  const { data, loading, refetch } = useRpc<Report>('assetReport', []);
  useRealtime('lich_sua', () => refetch());

  const [bks, setBks] = React.useState('');
  const [detail, setDetail] = React.useState<XeDetail | null>(null);
  const [history, setHistory] = React.useState<LichRow[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [showQuyet, setShowQuyet] = React.useState(false);
  const [scId, setScId] = React.useState('');
  const [ghiChu, setGhiChu] = React.useState('');

  async function traCuu(e?: React.FormEvent) {
    e?.preventDefault();
    const key = bks.trim();
    if (!key) return;
    setSearching(true);
    try {
      const [r1, r2] = await Promise.all([
        rpc<XeDetail>('assetXe', [key]),
        rpc<LichRow[]>('lichSuaList', { bks: key }),
      ]);
      if (r1.ok && r1.result) {
        setDetail(r1.result);
        setHistory((r2.result as LichRow[]) || []);
      } else {
        setDetail(null);
        setHistory([]);
        toast('Không tìm thấy xe ' + key, 'info');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lỗi tra cứu', 'err');
    } finally {
      setSearching(false);
    }
  }

  async function lamQuyetToan() {
    const id = scId.trim();
    if (!id) {
      toast('Nhập mã phiếu sửa chữa (SC-...) cần quyết toán', 'info');
      return;
    }
    const r = await rpc<{ tong?: number }>('quyetToan', { id, ghi_chu: ghiChu.trim() });
    if (r.ok) {
      toast('Đã quyết toán. Tổng: ' + fmtMoney((r.result?.tong as number) || 0), 'ok');
      setShowQuyet(false);
      setScId('');
      setGhiChu('');
      refetch();
      if (bks.trim()) traCuu();
    } else {
      toast(r.error || 'Quyết toán thất bại', 'err');
    }
  }

  if (!canXem) {
    return <div className="p-6 text-center text-gray-500">Bạn không có quyền xem模块 Tài sản.</div>;
  }

  const rows = data?.rows || [];
  const tong = data?.tong || {};

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tài sản &amp; Quyết toán</h2>
        {canQuyet && (
          <Button onClick={() => setShowQuyet(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M2 12l20-6v12L12 22l-6-4V6z"></path><line x1="12" y1="12" x2="12" y2="12"></line><line x1="12" y1="12" x2="12" y2="12"></line></svg>
            Quyết toán phiếu
          </Button>
        )}
      </div>

      {/* Tra cứu xe */}
      <form onSubmit={traCuu} className="flex gap-2 items-end bg-white/60 p-3 rounded-lg border border-black/5">
        <label className="text-sm">
          Biển kiểm soát
          <input
            className="input"
            value={bks}
            onChange={(e) => setBks(e.target.value)}
            placeholder="43A-01.234"
          />
        </label>
        <Button type="submit" disabled={searching}>
          {searching ? 'Đang tra…' : 'Tra cứu'}
        </Button>
      </form>

      {detail && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-2">Chi tiết xe {detail.xe.bks}</h3>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt>Loại xe</dt><dd>{detail.xe.hang} {detail.xe.dong}</dd></div>
              <div className="flex justify-between"><dt>Năm SX</dt><dd>{detail.xe.nam_sx}</dd></div>
              <div className="flex justify-between"><dt>Lái xe</dt><dd>{detail.xe.lai_xe || '—'}</dd></div>
              <div className="flex justify-between"><dt>Trạng thái</dt><dd>{detail.xe.trang_thai}</dd></div>
              <div className="flex justify-between"><dt>Nguyên giá</dt><dd>{fmtMoney(detail.nguyen_gia)}</dd></div>
              <div className="flex justify-between"><dt>Khấu hao/năm</dt><dd>{fmtMoney(detail.khau_hao_nam)}</dd></div>
              <div className="flex justify-between"><dt>Khấu hao lũy kế</dt><dd>{fmtMoney(detail.khau_hao)}</dd></div>
              <div className="flex justify-between"><dt>Số lần sửa</dt><dd>{detail.so_lan_sua}</dd></div>
              <div className="flex justify-between"><dt>Chi phí tích lũy</dt><dd>{fmtMoney(detail.chi_phi_tich_luy)}</dd></div>
              <div className="flex justify-between font-bold border-t pt-1"><dt>GTTV</dt><dd>{fmtMoney(detail.gttv)}</dd></div>
            </dl>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-2">Lịch sửa chữa ({history.length})</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có lịch sửa chữa.</p>
            ) : (
              <ul className="text-sm divide-y">
                {history.map((h) => (
                  <li key={h.id} className="py-1">
                    <div className="flex justify-between">
                      <span className="font-mono">{h.sc_id}</span>
                      <span>{fmtMoney(h.tong)}</span>
                    </div>
                    <div className="text-gray-500 text-xs">Ngày {h.ngay} · {h.nguoi}{h.ghi_chu ? ' · ' + h.ghi_chu : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Báo cáo toàn bộ */}
      <div className="card">
        <h3 className="font-semibold mb-2">Báo cáo tài sản ({rows.length} xe)</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Đang tải…</p>
        ) : (
          <div className="overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>BKS</th><th>Loại</th><th>Năm</th><th className="r">Nguyên giá</th>
                  <th className="r">Khấu hao</th><th className="r">SL sửa</th><th className="r">CP tích lũy</th><th className="r">GTTV</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bks}>
                    <td className="font-mono">{r.bks}</td>
                    <td>{r.hang} {r.dong}</td>
                    <td>{r.nam_sx}</td>
                    <td className="r">{fmtMoney(r.nguyen_gia)}</td>
                    <td className="r">{fmtMoney(r.khau_hao)}</td>
                    <td className="r">{r.so_lan_sua}</td>
                    <td className="r">{fmtMoney(r.chi_phi_tich_luy)}</td>
                    <td className="r font-semibold">{fmtMoney(r.gttv)}</td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="font-bold border-t">
                    <td colSpan={3}>TỔNG</td>
                    <td className="r">{fmtMoney(tong['nguyen_gia'] || 0)}</td>
                    <td className="r">{fmtMoney(tong['khau_hao'] || 0)}</td>
                    <td className="r"></td>
                    <td className="r">{fmtMoney(tong['chi_phi_tich_luy'] || 0)}</td>
                    <td className="r">{fmtMoney(tong['gttv'] || 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showQuyet && (
        <div className="modal-scrim" onClick={() => setShowQuyet(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Quyết toán phiếu sửa chữa</h3>
            <label className="text-sm block mb-2">
              Mã phiếu (SC-...)
              <input className="input" value={scId} onChange={(e) => setScId(e.target.value)} placeholder="SC-000001" />
            </label>
            <label className="text-sm block mb-3">
              Ghi chú
              <textarea className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} rows={3} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowQuyet(false)}>Hủy</Button>
              <Button onClick={lamQuyetToan}>Xác nhận quyết toán</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
