'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const r = useRouter();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'login', user:u, pass:p }),
      });
      const data = await res.json();
      if (!data.ok) { setErr(data.error || 'Sai tài khoản/mật khẩu'); return; }
      r.replace('/'); // redirect về dashboard (guard ở layout)
    } catch(e:any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="w-80 p-6 bg-white rounded shadow">
        <h1 className="text-xl font-bold mb-4">cencomOS v5.0</h1>
        <input className="w-full border p-2 mb-2" placeholder="Tài khoản" value={u} onChange={e=>setU(e.target.value)} required />
        <input type="password" className="w-full border p-2 mb-2" placeholder="Mật khẩu" value={p} onChange={e=>setP(e.target.value)} required />
        {err && <p className="text-red-500 text-sm mb-2">{err}</p>}
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">{loading?'Đang nhập...':'Đăng nhập'}</button>
      </form>
    </div>
  );
}
