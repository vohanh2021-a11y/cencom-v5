"use client";
import { useState } from "react";

export default function BackupPage() {
  const [msg, setMsg] = useState("");
  const backup = async () => {
    setMsg("Đang sao lưu...");
    const r = await fetch("/api/backup", { method: "POST" });
    const j = await r.json();
    setMsg(j.ok ? `✅ Đã sao lưu: ${j.file}` : "❌ " + j.error);
  };
  const restore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/backup/restore", { method: "POST", body: fd });
    const j = await r.json();
    setMsg(j.ok ? "✅ Khôi phục xong, reload trang" : "❌ " + j.error);
  };
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">💾 Sao lưu & Khôi phục (HUB)</h1>
      <div className="bg-slate-800 p-4 rounded-xl space-y-3">
        <button onClick={backup} className="px-4 py-2 bg-blue-600 rounded">Sao lưu ngay</button>
        <label className="block">Khôi phục từ file .dump
          <input type="file" accept=".dump,.sql" onChange={restore} className="mt-1" />
        </label>
        {msg && <p className="text-sm p-2 bg-slate-700 rounded">{msg}</p>}
        <p className="text-xs opacity-50">File lưu tại %APPDATA%/CencomOS/backup/ — HUB tự sao lưu hàng ngày khi chạy.</p>
      </div>
    </div>
  );
}
