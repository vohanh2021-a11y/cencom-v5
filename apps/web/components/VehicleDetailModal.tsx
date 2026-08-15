'use client';

import * as React from 'react';

/**
 * VehicleDetailModal — timeline 5 bước (Lập→Duyệt→Bắt đầu→Hẹn trả→Nghiệm thu).
 * Verbatim theo §06.4 (gd3.js openVehicleDetail). ESC / click nền đóng (§07).
 */
export default function VehicleDetailModal({
  vehicle,
  onClose,
}: {
  vehicle: any;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!vehicle) return null;

  const scs = vehicle.sc_details || [];
  const TT_LABEL: Record<string, string> = {
    de_xuat: 'Đề xuất',
    da_duyet: 'Đã duyệt',
    da_tong_duyet: 'Đã tổng duyệt',
    dang_sua: 'Đang sửa',
    cho_nghiem: 'Chờ nghiệm thu',
    da_hoan: 'Đã hoàn',
    da_quyet: 'Đã quyết toán',
    tu_choi: 'Từ chối',
  };
  const TT_COLOR: Record<string, string> = {
    de_xuat: '#F26A1F',
    da_duyet: '#E8A33D',
    da_tong_duyet: '#5BA8D4',
    dang_sua: '#1D9E68',
    cho_nghiem: '#7A4DF0',
    da_hoan: '#2ECC71',
    da_quyet: '#27AE60',
    tu_choi: '#E74C3C',
  };
  function fmt(d: string) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('vi-VN');
  }

  return (
    <div
      className="ovl"
      id="vhdModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          maxWidth: 700,
          width: '95%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{vehicle.bks}</div>
          {vehicle.hang ? (
            <div className="muted" style={{ fontSize: 13 }}>
              {vehicle.hang}
              {vehicle.nam_sx ? ' · ' + vehicle.nam_sx : ''}
            </div>
          ) : null}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: '#666' }}>📋 {scs.length} phiếu sửa chữa</span>
          <button className="btn sm ghost" onClick={onClose} style={{ fontSize: 18, padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        {scs.map((sc: any, idx: number) => {
          const stColor = TT_COLOR[sc.trang_thai] || '#999';
          const stLabel = TT_LABEL[sc.trang_thai] || sc.trang_thai;
          const steps = [
            { label: 'Lập', date: fmt(sc.ngay), done: !!sc.ngay },
            { label: 'Duyệt', date: sc.nguoi_duyet ? 'bởi ' + sc.nguoi_duyet : '—', done: !!sc.nguoi_duyet },
            { label: 'Bắt đầu', date: fmt(sc.ngay_bat_dau), done: !!sc.ngay_bat_dau },
            { label: 'Hẹn trả', date: fmt(sc.ngay_du_kien), done: false, special: true },
            { label: 'Nghiệm thu', date: fmt(sc.ngay_nghiem), done: !!sc.ngay_nghiem },
          ];
          const timeline = (
            <div className="vhd-timeline">
              <div className="vhd-tl-track" />
              {steps.map((s, i) => {
                const cls = s.done ? 'done' : s.special ? 'eta' : '';
                return (
                  <div className={'vhd-tl-step ' + cls} key={i}>
                    <div className="vhd-tl-dot" />
                    <div className="vhd-tl-label">{s.label}</div>
                    <div className="vhd-tl-date">{s.date}</div>
                  </div>
                );
              })}
            </div>
          );
          const loai = sc.la_sua_ngoai ? (
            <span className="badge sm" style={{ background: '#FFF3E0', color: '#E65100' }}>
              NC ngoài
            </span>
          ) : (
            <span className="badge sm" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
              Xưởng
            </span>
          );
          return (
            <div
              key={sc.id}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '14px 16px',
                marginTop: idx > 0 ? 12 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{sc.id}</span>
                <span className="badge sm" style={{ background: stColor + '20', color: stColor }}>
                  {stLabel}
                </span>
                {loai}
                <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
                  {sc.nguoi_lap || '—'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                {sc.mo_ta || 'Không có mô tả'}
              </div>
              {timeline}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#666' }}>
                <span>💰 {sc.tong_vnd}</span>
                <span>
                  🔧 {sc.so_cv_hoan}/{sc.so_cv} việc{sc.tho ? ' · ' + sc.tho : ''}
                </span>
                {sc.ngay_bat_dau ? <span>▶ {sc.ngay_bat_dau}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
