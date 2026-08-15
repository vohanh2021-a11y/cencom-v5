'use client';

import * as React from 'react';
import { useRpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { KpiCard } from '@/components/KpiCard';
import Kanban from '@/components/Kanban';
import VehicleDetailModal from '@/components/VehicleDetailModal';

function pct(a: number, b: number) {
  if (!b) return '0%';
  return Math.round((a || 0) / b * 100) + '%';
}

export default function DashboardPage() {
  const { data, error, refetch } = useRpc('dashboardAll');
  const [sel, setSel] = React.useState<any>(null);

  // Realtime: tự cập nhật KPI/Kanban khi SC / Đề xuất thay đổi (thay polling 45s)
  useRealtime('sc', () => refetch());
  useRealtime('de_xuat_sua_chua', () => refetch());

  const d: any = data || {};
  const kpi = d.kpi || {};
  const kpis = [
    { v: kpi.xe ?? 0, s: 'Số xe' },
    { v: kpi.sc_cho_duyet ?? 0, s: 'SC chờ duyệt' },
    { v: kpi.sc_dang_sua ?? 0, s: 'Đang sửa' },
    { v: kpi.sc_cho_nghiem ?? 0, s: 'Chờ nghiệm' },
    { v: kpi.dx_cho_duyet ?? 0, s: 'ĐX chờ duyệt' },
    { v: kpi.dx_da_duyet ?? 0, s: 'ĐX đã duyệt' },
    { v: kpi.sc_hoan_hom_nay ?? 0, s: 'Hoàn hôm nay' },
    { v: kpi.tien_quyet_hom_nay ?? 0, s: 'Tiền quyết hôm nay' },
  ];
  const cols: any[] = d.cols || [];
  const tho: any[] = d.tho || [];
  const bc: any = d.baocao_thang || {};

  function findVehicle(bks: string) {
    for (const col of cols) for (const c of col.cards) if (c.bks === bks) return c;
    return null;
  }

  return (
    <div className="content" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button className="btn sm" onClick={() => refetch()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M3 12a9 9 0 0 1 9-9 9.77 9.77 0 0 1 8.41 5.19L21 11"></path><path d="M21 4v10H11"></path><path d="M9 12c0-1.66-.33-3.26-.92-4.68"></path></svg>
          Làm mới
        </button>
      </div>

      {error ? (
        <div className="card" style={{ padding: 16, borderColor: '#E74C3C' }}>
          Không có quyền xem Bảng điều khiển xưởng (hoặc lỗi: {error}).
        </div>
      ) : null}

      <div className="kpis" style={{ marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <KpiCard key={i} value={k.v} label={k.s} />
        ))}
      </div>

      <Kanban cols={cols} onCardClick={(bks) => setSel(findVehicle(bks))} />

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ marginBottom: 8 }}>Công việc theo thợ</h3>
          <div className="kb-tho">
            {tho.map((t: any) => (
              <div className="tho" key={t.tho_id}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,var(--c-primary),var(--c-accent))',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {String(t.tho_name || '?').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <b>{t.tho_name}</b>
                </div>
                <div className="n">{t.n} việc</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ marginBottom: 8 }}>Báo cáo chi phí tháng {bc.thang}</h3>
          <div className="bc-row">
            <div className="bc-label">Xưởng (trong)</div>
            <div className="bc-track">
              <span className="bc-fill" style={{ width: pct(bc.trong?.tien, bc.tong_tien) }} />
            </div>
            <div className="bc-val">{(bc.trong?.tien || 0).toLocaleString('vi-VN')} ₫</div>
          </div>
          <div className="bc-row">
            <div className="bc-label">NC ngoài</div>
            <div className="bc-track">
              <span className="bc-fill ngoai" style={{ width: pct(bc.ngoai?.tien, bc.tong_tien) }} />
            </div>
            <div className="bc-val">{(bc.ngoai?.tien || 0).toLocaleString('vi-VN')} ₫</div>
          </div>
        </div>
      </div>

      {sel ? <VehicleDetailModal vehicle={sel} onClose={() => setSel(null)} /> : null}
    </div>
  );
}
