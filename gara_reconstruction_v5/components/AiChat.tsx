"use client";
import { useState } from "react";

export default function AiChat() {
  const [msgs, setMsgs] = useState<{role:string, content:string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMsgs(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...msgs, userMsg] })
      });
      const j = await r.json();
      setMsgs(m => [...m, { role: "assistant", content: j.ok ? j.content : "❌ " + j.error }]);
    } catch (e:any) {
      setMsgs(m => [...m, { role: "assistant", content: "Lỗi: " + e.message }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[400px] border rounded-xl bg-slate-900">
      <div className="p-2 border-b font-bold">🤖 AI Trợ lý (chỉ data nội bộ)</div>
      <div className="flex-1 overflow-auto p-3 space-y-2 text-sm">
        {msgs.map((m,i)=><div key={i} className={m.role==="user"?"text-right":"text-left"}><span className={m.role==="user"?"bg-blue-600":"bg-slate-700"} style={{padding:"6px 10px", borderRadius:8, display:"inline-block", maxWidth:"80%"}}>{m.content}</span></div>)}
        {msgs.length===0 && <p className="opacity-50 text-xs">Gợi ý: “Tồn kho thiếu gì?” “Công nợ quá hạn?” “SC nào chưa duyệt?”</p>}
      </div>
      <div className="p-2 flex gap-2 border-t">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Hỏi AI..." className="flex-1 p-2 rounded bg-slate-800" />
        <button onClick={send} disabled={loading} className="px-4 bg-blue-600 rounded disabled:opacity-50">{loading?"..." : "Gửi"}</button>
      </div>
    </div>
  );
}
