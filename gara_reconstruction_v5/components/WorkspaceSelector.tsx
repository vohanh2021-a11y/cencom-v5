'use client';

/* W4.4 —_port v4 apps/web/components/WorkspaceSelector.tsx (verbatim).
 * CSS .ws-select/.ws-menu port sang app/globals.css (khối WORKSPACE THEMES). */

import * as React from 'react';
import { useWorkspace } from './WorkspaceContext';

export default function WorkspaceSelector() {
  const { ws, setWs, allowed } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="ws-select" ref={ref}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chọn không gian làm việc"
      >
        <span aria-hidden="true">{allowed.find((w) => w.id === ws)?.icon || '▦'}</span>
        <span className="hidden sm:inline">{allowed.find((w) => w.id === ws)?.label || 'Workspace'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="ws-menu" role="listbox" aria-label="Danh sách workspace">
          {allowed.map((w) => (
            <li key={w.id} role="option" aria-selected={w.id === ws}>
              <button
                className={w.id === ws ? 'active' : ''}
                onClick={() => {
                  setWs(w.id);
                  setOpen(false);
                }}
              >
                <span aria-hidden="true">{w.icon}</span>
                <span>{w.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
