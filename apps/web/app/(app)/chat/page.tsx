'use client';

import * as React from 'react';
import { rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';

interface Thread {
  id: string;
  peer: string;
  unread: number;
  last_msg: string;
}
interface Peer {
  id: string;
  name: string;
  role: string;
}
interface Message {
  id: number;
  thread: string;
  from: string;
  to: string;
  body: string;
  kind: string;
  img_path: string;
  created_at: string;
}

export default function ChatPage() {
  const toast = useToast();
  const { perms, user } = useSession();
  const meId = user?.id || '';

  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [peers, setPeers] = React.useState<Record<string, string>>({});
  const [activeThread, setActiveThread] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [peerPicker, setPeerPicker] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const messagesEnd = React.useRef<HTMLDivElement>(null);

  async function loadThreads() {
    const r = await rpc<Thread[]>('chatList', []);
    if (r.ok) setThreads(r.result || []);
  }
  async function loadPeers() {
    const r = await rpc<Peer[]>('chatPeers', []);
    if (r.ok) {
      const m: Record<string, string> = {};
      (r.result || []).forEach((p) => (m[p.id] = p.name));
      setPeers(m);
    }
  }
  async function loadMessages(threadId: string) {
    const r = await rpc<Message[]>('chatMessages', [{ thread: threadId }]);
    if (r.ok) setMessages(r.result || []);
    scrollToBottom();
  }

  React.useEffect(() => {
    (async () => {
      await Promise.all([loadThreads(), loadPeers()]);
      setLoading(false);
    })();
  }, []);

  React.useEffect(() => {
    if (activeThread) loadMessages(activeThread);
  }, [activeThread]);

  useRealtime('chat_messages', () => {
    if (activeThread) loadMessages(activeThread);
    loadThreads();
  });

  function scrollToBottom() {
    setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  function peerName(id: string) {
    return peers[id] || id;
  }
  function activePeer(): string {
    return threads.find((t) => t.id === activeThread)?.peer || '';
  }

  async function startChat(peerId: string) {
    const r = await rpc<{ ok: boolean; thread?: string }>('chatThreadOpen', [{ to: peerId }]);
    if (!r.ok || !r.result?.thread) {
      toast(r.error || 'Không mở được cuộc trò chuyện', 'err');
      return;
    }
    setPeerPicker(false);
    await loadThreads();
    setActiveThread(r.result.thread);
  }

  async function sendMessage() {
    const peer = activePeer();
    if (!input.trim() || !peer) return;
    const r = await rpc('chatSend', [{ to: peer, body: input.trim() }]);
    if (r.ok) {
      setInput('');
      loadMessages(activeThread!);
      loadThreads();
    } else {
      toast(r.error || 'Gửi thất bại', 'err');
    }
  }

  async function sendImage(file: File) {
    const peer = activePeer();
    if (!peer) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const r = await rpc('chatSendImg', [{ to: peer, img: b64 }]);
      if (r.ok) {
        loadMessages(activeThread!);
        loadThreads();
      } else {
        toast(r.error || 'Gửi ảnh thất bại (cần JPG)', 'err');
      }
    };
    reader.readAsDataURL(file);
  }

  async function deleteMsg(id: number) {
    const r = await rpc('chatDeleteMsg', [{ id }]);
    if (r.ok) loadMessages(activeThread!);
    else toast(r.error || 'Xóa thất bại', 'err');
  }

  if (!perms?.['chat']) {
    return <div className="p-6 text-center text-gray-500">Bạn không có quyền sử dụng Chat.</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Danh sách cuộc trò chuyện */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold">Chat</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPeerPicker((v) => !v)} aria-label="Thêm người chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
        {peerPicker && (
          <div className="max-h-48 overflow-auto border-b bg-black/5">
            {Object.keys(peers).length === 0 && <div className="p-2 text-sm text-gray-500">Không có người dùng.</div>}
            {Object.keys(peers).map((pid) => (
              <button key={pid} className="w-full text-left p-2 hover:bg-white text-sm" onClick={() => startChat(pid)}>
                {peers[pid]}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-auto flex-1">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveThread(t.id)}
              className={`w-full text-left p-3 border-b hover:bg-gray-50 ${activeThread === t.id ? 'bg-blue-50' : ''}`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{peerName(t.peer)}</span>
                {t.unread > 0 && <span className="notif-badge">{t.unread}</span>}
              </div>
              <div className="text-sm text-gray-500 truncate">{t.last_msg || '…'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tin nhắn */}
      <div className="flex-1 flex flex-col">
        {!activeThread ? (
          <div className="flex-1 grid place-items-center text-gray-400">Chọn hoặc bắt đầu một cuộc trò chuyện</div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {messages.map((m) => {
                const mine = m.from === meId;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`max-w-xs px-3 py-2 rounded-lg ${mine ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                      {m.img_path ? (
                        <a href={`/chat/file/${m.img_path}`} target="_blank" rel="noreferrer" className="underline flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="10 15.5 14 11.5 18 15.5"></polyline></svg>
                          Xem ảnh
                        </a>
                      ) : (
                        <span>{m.body}</span>
                      )}
                      <div className="text-xs opacity-70 mt-1">{m.created_at}</div>
                    </div>
                      {mine && (
                        <button
                          className="ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteMsg(Number(m.id))}
                          title="Xóa tin của bạn"
                          aria-label="Xóa tin"
                        >
                          ✕
                        </button>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEnd} />
            </div>

            <div className="p-4 border-t flex gap-2 items-center">
              <input
                type="file"
                accept="image/jpeg"
                ref={fileRef}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendImage(f);
                  e.target.value = '';
                }}
              />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} title="Gửi ảnh JPG" aria-label="Gửi ảnh JPG">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="10 15.5 14 11.5 18 15.5"></polyline></svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Nhập tin nhắn…"
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
              <button className="btn btn-primary" onClick={sendMessage}>Gửi</button>
            </div>
          </>
        )}
      </div>

      {loading && <div className="absolute inset-0 grid place-items-center text-gray-400">Đang tải…</div>}
    </div>
  );
}
