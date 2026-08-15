import * as React from 'react';

/**
 * VehicleCard — 1 ô Kanban = 1 xe (group SC cùng BKS).
 * Render verbatim theo §06.2 (gd3.js).
 */
function etaBadge(eta: any) {
  if (!eta || typeof eta !== 'object') return null;
  const con = Number(eta.con);
  let cls = 'ok';
  let lbl = 'Hẹn ' + eta.ngay;
  if (con < 0) {
    cls = 'over';
    lbl = 'Trễ ' + Math.abs(con) + ' ngày';
  } else if (con === 0) {
    cls = 'warn';
    lbl = 'Hẹn hôm nay';
  }
  return (
    <div className="eta-set">
      <span className={'kb-eta ' + cls}>⏰ {lbl}</span>
    </div>
  );
}

export default function VehicleCard({
  card,
  onClick,
}: {
  card: any;
  onClick: (bks: string) => void;
}) {
  const c = card || {};
  const badges: React.ReactNode[] = [];
  if (c.sc_count > 1) {
    if (c.sc_dang_sua)
      badges.push(
        <span key="d" className="badge sm blue">
          🔧 {c.sc_dang_sua} đang sửa
        </span>,
      );
    if (c.sc_cho_nghiem)
      badges.push(
        <span key="n" className="badge sm purple">
          📋 {c.sc_cho_nghiem} chờ nghiệm
        </span>,
      );
    if (c.sc_cho_duyet)
      badges.push(
        <span key="x" className="badge sm orange">
          📝 {c.sc_cho_duyet} chờ duyệt
        </span>,
      );
  }
  const scLabel =
    c.sc_count > 1
      ? '📋 ' + c.sc_count + ' phiếu SC'
      : '📋 ' + (c.sc_ids && c.sc_ids[0] ? c.sc_ids[0] : '');

  return (
    <div className="kb-card vehicle-card" onClick={() => onClick(c.bks)}>
      <div className="bks">
        {c.bks}
        {c.hang ? (
          <span className="muted" style={{ fontSize: 11 }}>
            {' '}
            {c.hang}
            {c.nam_sx ? ' · ' + c.nam_sx : ''}
          </span>
        ) : null}
      </div>
      <div className="meta" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="kb-sc-count">{scLabel}</span>
        <span className="ttl">{c.tong_tien_vnd}</span>
      </div>
      {badges.length ? <div className="kb-badges">{badges}</div> : null}
      {c.phan_tram > 0 ? (
        <div className="kb-bar">
          <i style={{ width: Math.min(100, c.phan_tram) + '%' }} />
        </div>
      ) : null}
      <div className="meta">{c.tho_chinh ? <span>🔧 {c.tho_chinh}</span> : null}</div>
      {etaBadge(c.eta)}
    </div>
  );
}
