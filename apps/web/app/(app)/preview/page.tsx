'use client';

import * as React from 'react';
import { rpc } from '@/lib/use-rpc';
import { useSession } from '@/components/SessionContext';
import { fmtMoney } from '@/lib/format';

const ROLES: Array<[string, string]> = [
  ['giamdoc', 'Giám đốc'],
  ['quanly', 'Quản lý'],
  ['ketoan', 'Kế toán'],
  ['tho', 'Thợ kỹ thuật'],
  ['khoa', 'Thủ kho'],
  ['xuong', 'Quản lý xưởng'],
  ['laixe', 'Lái xe'],
];

type Demo = {
  info?: { nav: Array<Record<string, unknown>>; actions: Array<Record<string, unknown>> };
  home?: Record<string, unknown>;
  sc?: { rows: Array<Record<string, unknown>> };
  kho?: { rows: Array<Record<string, unknown>>; lowCount: number; giaTriTonKho: number };
  dm?: { rows: Array<Record<string, unknown>> };
};

export default function PreviewPage() {
  const { user } = useSession();
  const [role, setRole] = React.useState<string>('quanly');
  const [demo, setDemo] = React.useState<Demo | null>(null);
  const [loading, setLoading] = React.useState(false);

  const isAdmin = user?.role === 'admin';

  async function load(r: string) {
    setLoading(true);
    try {
      const [info, home, sc, kho, dm] = await Promise.all([
        rpc('previewInfo', [r]),
        rpc('previewHome', [r]),
        rpc('previewSC', [r]),
        rpc('previewKho', [r]),
        rpc('previewDM', [r]),
      ]);
      setDemo({
        info: info.result as Demo['info'],
        home: home.result as Demo['home'],
        sc: sc.result as Demo['sc'],
        kho: kho.result as Demo['kho'],
        dm: dm.result as Demo['dm'],
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (isAdmin) load(role);
  }, [role, isAdmin]);

  if (!isAdmin) {
    return <div className="p-6 text-center text-gray-500">Chức năng Preview chỉ dành cho Quản trị viên.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Xem thử góc nhìn vai trò</h2>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500">Đang tải dữ liệu mẫu…</p>}
      {demo && (
        <div className="space-y-4">
          {demo.info && (
            <div className="card">
              <h3 className="font-semibold mb-2">Menu &amp; Hành động khả dụng</h3>
              <div className="flex flex-wrap gap-1 mb-2">
                {demo.info.nav.filter((n) => n['on']).map((n) => (
                  <span key={String(n['key'])} className="chip chip-on">{String(n['label'])}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {demo.info.actions.map((a, i) => (
                  <span key={i} className="chip">{String(a['label'])}</span>
                ))}
              </div>
            </div>
          )}

          {demo.home && (
            <div className="card">
              <h3 className="font-semibold mb-2">Bảng điều khiển (mẫu)</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="Xe" v={(demo.home['stats'] as any)?.xe} />
                <Stat label="SC chờ duyệt" v={(demo.home['stats'] as any)?.scChoDuyet} />
                <Stat label="SC đang sửa" v={(demo.home['stats'] as any)?.scDang} />
                <Stat label="Đề nghị chờ duyệt" v={(demo.home['stats'] as any)?.dmChoDuyet} />
                <Stat label="Tồn thấp" v={(demo.home['stats'] as any)?.lowTon} />
                <Stat label="SBD" v={(demo.home['stats'] as any)?.sbd} />
              </div>
            </div>
          )}

          {demo.sc && (
            <div className="card">
              <h3 className="font-semibold mb-2">Phiếu sửa chữa (mẫu)</h3>
              <PreviewTable rows={demo.sc.rows} />
            </div>
          )}

          {demo.kho && (
            <div className="card">
              <h3 className="font-semibold mb-2">
                Kho (mẫu) · {demo.kho.lowCount} tồn thấp · {fmtMoney(demo.kho.giaTriTonKho)}
              </h3>
              <PreviewTable rows={demo.kho.rows} />
            </div>
          )}

          {demo.dm && (
            <div className="card">
              <h3 className="font-semibold mb-2">Đề nghị mua (mẫu)</h3>
              <PreviewTable rows={demo.dm.rows} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v?: number }) {
  return (
    <div className="bg-black/5 rounded p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold">{v ?? 0}</div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-sm text-gray-500">Không có dữ liệu mẫu cho vai này.</p>;
  const cols = Object.keys(rows[0] ?? {});
  return (
    <div className="overflow-auto">
      <table className="tbl">
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => <td key={c} className="text-xs">{String(r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
