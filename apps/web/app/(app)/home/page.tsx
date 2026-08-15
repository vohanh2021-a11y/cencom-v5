'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useRpc } from '@/lib/use-rpc';
import { KpiCard } from '@/components/KpiCard';

const QUICK = [
  { label: 'Tạo phiếu sửa chữa', href: '/sc/create' },
  { label: 'Nhập kho', href: '/kho' },
  { label: 'Xuất kho', href: '/kho' },
  { label: 'Đề nghị mua', href: '/kho' },
  { label: 'Thăm khám / Sửa chữa', href: '/sc' },
  { label: 'Bảng điều khiển', href: '/dashboard' },
];

export default function HomePage() {
  const { data, loading } = useRpc('welcomeData');
  const router = useRouter();
  const d: any = data || {};
  const stats = d.stats || {};
  const kpis = [
    { v: stats.scChoDuyet || 0, s: 'SC chờ duyệt' },
    { v: stats.scDang || 0, s: 'Đang sửa' },
    { v: stats.scChoNghiem || 0, s: 'Chờ nghiệm' },
    { v: stats.dmChoDuyet || 0, s: 'ĐN mua chờ' },
    { v: stats.lowTon || 0, s: 'VT sắp hết' },
  ];
  const myTasks: any[] = d.myTasks || [];
  const lowTon: any[] = d.lowTon || [];

  return (
    <div className="content" style={{ padding: 24 }}>
      <div className="card" style={{ marginBottom: 16, padding: 18 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Xin chào {d.me?.name || ''}</h2>
        <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>
          {d.greeting} · {d.thu}, {d.ngay} · {d.gio}
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <KpiCard key={i} value={k.v} label={k.s} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {QUICK.map((q) => (
          <button key={q.label} className="quick" onClick={() => router.push(q.href)}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h3 style={{ color: '#fff', fontSize: 15, marginBottom: 8 }}>Việc cần xử lý</h3>
        {myTasks.length === 0 ? <div className="due">Không có việc chờ.</div> : null}
        {myTasks.map((t, i) => (
          <div className="due" key={i}>
            {t.type === 'note' ? (
              <div>{t.text}</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div>
                  <b>{t.bks || ''}</b>
                  {t.tong != null ? (
                    <span className="chip" style={{ marginLeft: 8 }}>
                      {Number(t.tong).toLocaleString('vi-VN')} ₫
                    </span>
                  ) : null}
                </div>
                <div>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const id = t.sc_id || t.dm_id || t.dx_id;
                      const base = t.sc_id ? '/sc/' : t.dm_id ? '/kho' : '/de-xuat/';
                      if (id) router.push(base + id);
                    }}
                  >
                    Xem phiếu →
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ color: '#fff', fontSize: 15, marginBottom: 8 }}>Vật tư sắp hết</h3>
        {lowTon.length === 0 ? (
          <div className="due">Đủ vật tư.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Đơn vị</th>
                <th>Tồn</th>
                <th>Tối thiểu</th>
              </tr>
            </thead>
            <tbody>
              {lowTon.map((v: any) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.donvi}</td>
                  <td>{v.ton}</td>
                  <td>{v.ton_min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
