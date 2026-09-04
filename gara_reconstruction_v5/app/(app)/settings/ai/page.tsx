"use client";
import { useState, useEffect } from "react";

export default function AiSettingsPage() {
  const [form, setForm] = useState({ provider: "custom", baseURL: "https://api.b.ai/v1", apiKey: "", model: "mimo-v2.5-flash-free" });
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/ai/config").then(r=>r.json()).then(j=>{ if(j.ok && j.config) setForm(j.config); }).catch(()=>{});
  }, []);

  const save = async () => {
    const r = await fetch("/api/ai/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    setMsg(j.ok ? "✅ Đã lưu cấu hình AI" : "❌ " + j.error);
  };
  const test = async () => {
    setTesting(true);
    const r = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    setMsg(j.ok ? "✅ Kết nối OK: " + j.model : "❌ " + j.error);
    setTesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">⚙️ Cài đặt AI (HUB)</h1>
      <p className="opacity-70 text-sm">Nhập provider OpenAI-compatible. Khuyến nghị: baseURL https://api.b.ai/v1, model mimo-v2.5-flash-free hoặc muse-spark-1.2-contributor-free (có vision).</p>
      <div className="space-y-4 bg-slate-800 p-4 rounded-xl">
        <label className="block">Provider
          <select value={form.provider} onChange={e=>setForm({...form, provider:e.target.value})} className="w-full mt-1 p-2 rounded bg-slate-700">
            <option value="custom">Custom (OpenAI compatible)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label className="block">Base URL
          <input value={form.baseURL} onChange={e=>setForm({...form, baseURL:e.target.value})} placeholder="https://api.b.ai/v1" className="w-full mt-1 p-2 rounded bg-slate-700" />
        </label>
        <label className="block">API Key
          <input type="password" value={form.apiKey} onChange={e=>setForm({...form, apiKey:e.target.value})} className="w-full mt-1 p-2 rounded bg-slate-700" />
        </label>
        <label className="block">Model
          <input value={form.model} onChange={e=>setForm({...form, model:e.target.value})} placeholder="mimo-v2.5-flash-free" className="w-full mt-1 p-2 rounded bg-slate-700" />
        </label>
        <div className="flex gap-2">
          <button onClick={save} className="px-4 py-2 bg-blue-600 rounded">Lưu</button>
          <button onClick={test} disabled={testing} className="px-4 py-2 bg-emerald-600 rounded disabled:opacity-50">{testing?"Đang test...":"Test kết nối"}</button>
        </div>
        {msg && <p className="text-sm p-2 bg-slate-700 rounded">{msg}</p>}
      </div>
      <div className="text-xs opacity-50">API key được mã hóa AES-256-GCM trước khi lưu vào bảng config. HUB mới có mục này, Spoke không cần.</div>
    </div>
  );
}
