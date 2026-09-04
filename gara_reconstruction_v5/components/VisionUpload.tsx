"use client";
import { useState } from "react";

export default function VisionUpload({ onExtract }: { onExtract: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg("Đang đọc ảnh bằng AI vision...");
    const fd = new FormData();
    fd.append("image", file);
    try {
      const r = await fetch("/api/ai/vision", { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) {
        setMsg("✅ Đã trích xuất, kiểm tra lại trước khi lưu");
        onExtract(j.extracted);
      } else setMsg("❌ " + j.error);
    } catch (err: any) {
      setMsg("❌ " + err.message);
    }
    setLoading(false);
  };
  return (
    <div className="border-2 border-dashed border-slate-600 rounded-xl p-4 bg-slate-800/50">
      <p className="font-bold">📷 Vision — Upload ảnh hóa đơn viết tay</p>
      <p className="text-xs opacity-60">Hỗ trợ mimo-v2.5 / Muse Spark (đã cấu hình tại Cài đặt → AI)</p>
      <input type="file" accept="image/*" onChange={upload} disabled={loading} className="mt-2" />
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </div>
  );
}
