'use client';

/**
 * GlobalSearch.tsx — W4.2 · ô tìm kiếm TOÀN CỤC (header).
 * W4-reg: fn `globalSearch` ĐÃ đăng ký lib/rpc.ts (META ['sc','xem']) +
 * mount vào topbar: app/(app)/layout.tsx (desktop, `hidden lg:flex`) và
 * components/nav.tsx (mobile topbar lg:hidden) — mỗi breakpoint MỘT ô.
 * Chiến lược graceful GIỮ NGUYÊN (probe phòng registry lệch):
 *  - Probe thật bằng chính các lần gõ (debounce 250ms): response 404
 *    'Unknown fn' → isFnUnavailable (mirror helper local sc/page.tsx:118 —
 *    cùng bài toán W2b/W3.5, KHÔNG dedupe vì task cấm sửa lib/hooks) →
 *    INPUT DISABLE + title='W4-reg' (chặn spam 404 mỗi lần gõ tiếp).
 *  - Envelope 2 tầng theo quy ước W1b+ (route bọc {ok,result}, core tự bọc
 *    {ok,result}/{ok,error} → đọc dữ liệu thật = res.result.result — khuôn
 *    app/(app)/kho/page.tsx:1233-1241).
 * - Điều hướng theo đặc task: sc → `/sc/<mã>` (route /sc/[id] ĐÃ có từ
 *   W4-reg — app/(app)/sc/[id]/page.tsx render ScPage mở sẵn modal theo mã)
 *   · xe → `/xe?q=` · dm → `/kho/dm?q=` · vattu → `/kho?q=`. GHI NHẬN
 *   W4-reg: trang xe/kho HIỆN CHƯA đọc tham số `q` (không có ô lọc keyword
 *   — grep searchParams/kw = 0 match) → click chỉ đưa về danh sách lĩnh vực,
 *   không pre-lọc. Bổ sung tiêu thụ `q` = việc riêng của wave UI page
 *   (ngoài phạm vi reg), ghi vào Production Check bàn giao.
 *
 * Input rendering: React text node (escape mặc định) — KHÔNG dangerouslySetInnerHTML.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, type RpcResult } from '@/lib/hooks/useApi';

/** mirror isFnUnavailable (app/(app)/sc/page.tsx:118) — fn chưa vào registry. */
function isFnUnavailable(res: RpcResult): boolean {
  if (res.ok) return false;
  if (res.status === 404) return true;
  const e = String(res.error || '').toLowerCase();
  return e.includes('unknown fn') || e.includes('fn chưa khả dụng');
}

interface ScHit {
  ma: string;
  trang_thai: string;
  bien_so: string | null;
}
interface XeHit {
  id: string;
  bien_so: string;
  chu_xe: string | null;
}
interface DmHit {
  id: string;
  trang_thai: string;
  sc_id: string | null;
}
interface VtHit {
  id: string;
  ten: string;
  don_vi: string | null;
}
interface SearchGroups {
  sc: ScHit[];
  xe: XeHit[];
  dm: DmHit[];
  vattu: VtHit[];
}
type CoreEnv = { ok?: boolean; result?: SearchGroups; error?: string };

interface GroupView {
  key: string;
  label: string;
  items: { id: string; title: string; sub: string; href: string }[];
}

const LIMIT_PER_GROUP = 8;

export default function GlobalSearch({ className = '' }: { className?: string }) {
  const api = useApi();
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [groups, setGroups] = useState<SearchGroups | null>(null);
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // bắt race: response cũ (gõ nhanh) không được đè response mới
  const reqId = useRef(0);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  const run = useCallback(
    async (q: string) => {
      const myReq = ++reqId.current;
      const res = await api.call('globalSearch', { q, limit: LIMIT_PER_GROUP });
      if (myReq !== reqId.current) return; // có truy vấn mới hơn — bỏ kết quả cũ
      if (isFnUnavailable(res)) {
        setUnavailable(true);
        setGroups(null);
        return;
      }
      const env = (res.ok ? (res.result as CoreEnv | undefined) : undefined) ?? null;
      if (env && env.ok === true && env.result) setGroups(env.result);
      else setGroups(null); // business error (q<2 / chưa đăng nhập) — ẩn dropdown
    },
    [api]
  );

  const onChange = useCallback(
    (value: string) => {
      setTerm(value);
      setOpen(true);
      if (debounce.current) clearTimeout(debounce.current);
      const q = value.trim();
      if (q.length < 2) {
        setGroups(null);
        return; // pattern v4: không truy vấn khi query cụt (đỡ 404 core)
      }
      debounce.current = setTimeout(() => void run(q), 250);
    },
    [run]
  );

  // đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const views = useMemo<GroupView[]>(() => {
    if (!groups) return [];
    return [
      {
        key: 'sc',
        label: 'Phiếu sửa chữa',
        items: groups.sc.map((s) => ({
          id: s.ma,
          title: s.ma,
          sub: [s.bien_so, s.trang_thai].filter(Boolean).join(' · '),
          // /sc/[id] có từ W4-reg — xem header file (kết quả: s.ma = mã phiếu).
          href: `/sc/${encodeURIComponent(s.ma)}`,
        })),
      },
      {
        key: 'xe',
        label: 'Xe',
        items: groups.xe.map((x) => ({
          id: x.id,
          title: x.bien_so,
          sub: x.chu_xe ?? '',
          href: `/xe?q=${encodeURIComponent(x.bien_so)}`,
        })),
      },
      {
        key: 'dm',
        label: 'Đề nghị mua',
        items: groups.dm.map((d) => ({
          id: d.id,
          title: d.id,
          sub: [d.sc_id, d.trang_thai].filter(Boolean).join(' · '),
          href: `/kho/dm?q=${encodeURIComponent(d.id)}`,
        })),
      },
      {
        key: 'vattu',
        label: 'Vật tư',
        items: groups.vattu.map((v) => ({
          id: v.id,
          title: v.ten,
          sub: v.don_vi ?? '',
          href: `/kho?q=${encodeURIComponent(v.ten)}`,
        })),
      },
    ].filter((g) => g.items.length > 0);
  }, [groups]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const disabled = unavailable || api.loading;
  const total = views.reduce((n, g) => n + g.items.length, 0);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <input
        type="search"
        role="searchbox"
        aria-label="Tìm kiếm toàn cục"
        aria-expanded={open && total > 0}
        aria-haspopup="listbox"
        value={term}
        disabled={disabled}
        title={unavailable ? 'W4-reg' : 'Tìm mã phiếu / biển số / đề nghị mua / vật tư'}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        placeholder={unavailable ? 'Tìm kiếm (chưa mở — W4-reg)' : 'Tìm: mã phiếu, biển số, DM, vật tư…'}
      />
      {open && views.length > 0 && (
        <div
          role="listbox"
          aria-label="Kết quả tìm kiếm"
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-auto rounded border border-slate-200 bg-white shadow-lg"
        >
          {views.map((g) => (
            <div key={g.key}>
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {g.label}
              </div>
              {g.items.map((it) => (
                <button
                  key={g.key + ':' + it.id}
                  type="button"
                  onClick={() => go(it.href)}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100"
                >
                  <span className="font-medium text-slate-800">{it.title}</span>
                  {it.sub && <span className="text-xs text-slate-500">{it.sub}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && !unavailable && term.trim().length >= 2 && total === 0 && !api.loading && (
        <div role="status" className="absolute left-0 right-0 z-30 mt-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          Không tìm thấy kết quả cho “{term.trim()}”
        </div>
      )}
    </div>
  );
}
