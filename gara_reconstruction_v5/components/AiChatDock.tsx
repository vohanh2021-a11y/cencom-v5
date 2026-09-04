"use client";
import { useState } from "react";
import AiChat from "./AiChat";

export default function AiChatDock() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={()=>setOpen(!open)} className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center text-xl">
        {open ? "✕" : "🤖"}
      </button>
      {open && (
        <div className="fixed bottom-20 right-4 w-96 shadow-2xl rounded-xl overflow-hidden border bg-white">
          <AiChat />
        </div>
      )}
    </>
  );
}
