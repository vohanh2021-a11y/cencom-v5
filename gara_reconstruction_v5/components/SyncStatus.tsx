"use client";
import { useEffect, useState } from "react";

export default function SyncStatus() {
  const [pending, setPending] = useState<number | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        // Thử gọi HUB health qua LAN
        const r = await fetch("/api/sync/pull?since=1970-01-01", { method: "GET" });
        setOnline(r.ok);
        // Nếu là Spoke (có window.spokeAPI), lấy queue length
        const w: any = window;
        if (w.spokeAPI?.queueList) {
          const q = await w.spokeAPI.queueList();
          setPending(q.filter((x: any) => x.status === "pending").length);
        }
      } catch {
        setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 5000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { clearInterval(id); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const syncNow = async () => {
    const w: any = window;
    if (w.spokeAPI?.syncNow) {
      await w.spokeAPI.syncNow();
      location.reload();
    } else {
      // Hub: không cần sync
      location.reload();
    }
  };

  if (pending === null && online) return null;
  return (
    <div className={`fixed bottom-4 left-4 px-3 py-2 rounded-full text-xs font-bold flex items-center gap-2 ${online ? "bg-amber-500 text-white" : "bg-red-600 text-white"}`}>
      <span>{online ? "● Online" : "○ Offline"}</span>
      {pending !== null && pending > 0 && <span>{pending} chưa đồng bộ</span>}
      {pending !== null && pending > 0 && online && <button onClick={syncNow} className="ml-2 px-2 py-1 bg-white text-amber-600 rounded">Đồng bộ</button>}
    </div>
  );
}
