'use client';

import { useEffect, useState } from 'react';

const ROLES = ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'];
const MODULES = ['sc', 'kho', 'mua', 'asset', 'xe', 'chat', 'de_xuat', 'xuong', 'report'];
const FEATURES = ['xem', 'tao', 'sua', 'duy', 'quyet', 'xuat', 'xoa', 'kehoach'];

export default function PermPage() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, string[]>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMatrix();
  }, []);

  async function loadMatrix() {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn: 'permMatrix', args: [{}] }),
    });
    const data = await res.json();
    if (data.ok) setMatrix(data.result as Record<string, Record<string, string[]>>);
    setLoading(false);
  }

  async function toggle(role: string, module: string, feature: string) {
    const current = matrix[role]?.[module] || [];
    const has = current.includes(feature);
    const newFeatures = has ? current.filter(f => f !== feature) : [...current, feature];

    const newMatrix = { ...matrix };
    newMatrix[role] = { ...newMatrix[role], [module]: newFeatures };
    setMatrix(newMatrix);

    // Save
    setSaving(true);
    try {
      await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fn: 'permSave',
          args: [{ changes: [{ role, module, feature, on: !has }] }],
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">Đang tải...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Phân quyền (RBAC)</h1>
      {saving && <div className="mb-4 text-sm text-blue-600">Đang lưu...</div>}

      <div className="bg-white rounded shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left">Vai trò</th>
              {MODULES.map(m => (
                <th key={m} className="px-4 py-2 text-center">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map(role => (
              <tr key={role} className="border-t">
                <td className="px-4 py-2 font-medium">{role}</td>
                {MODULES.map(module => (
                  <td key={module} className="px-4 py-2 text-center">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {FEATURES.map(feature => {
                        const has = (matrix[role]?.[module] || []).includes(feature);
                        return (
                          <button
                            key={feature}
                            onClick={() => toggle(role, module, feature)}
                            className={`px-2 py-1 text-xs rounded ${has ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                            title={`${feature}`}
                          >
                            {feature}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
