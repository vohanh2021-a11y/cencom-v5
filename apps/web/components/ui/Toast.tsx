'use client';
import * as React from 'react';

type ToastType = 'ok' | 'err' | 'info';
type ToastItem = { id: number; msg: string; type: ToastType };
type ShowFn = (msg: string, type?: ToastType) => void;

const ToastCtx = React.createContext<ShowFn>(() => {});
export function useToast() {
  return React.useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const show = React.useCallback<ShowFn>((msg, type = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1500);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type} show`}
          onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
        >
          {t.msg}
        </div>
      ))}
    </ToastCtx.Provider>
  );
}
