/**
 * app/in/[type]/[id]/page.tsx — W4.3: IN HTML A4 (server component, Next 14).
 *
 * Port v3.6 `server/in.js` (8 mẫu p1..p8 + hoSo) sang HTML/JSX trên dữ liệu v5:
 *  - type ∈ {kehoach,kiemtu,baogia,nhapkho,xuatkho,nghiemthu,bangke,hoso}
 *  - id: SC-xxxxxx (6 mẫu SC), BG-xxxxxx (báo giá), NX-xxxxxx (nhập/xuất — v5 gộp
 *    bảng nhap_xuat, thay PXN/PXX của v3.6; mẫu baogia/nhapkho/xuatkho cũng nhận
 *    SC- để tìm phiếu đầu theo quan hệ).
 *  - Dữ liệu load TRỰC TIẾP core qua lib/print (scGet/xeGet/phieuGet/baogiaGet/
 *    checkHoSo) — KHÔNG tự chế SQL trùng contract, KHÔNG gọi lại /api/rpc.
 *  - Auth: đọc cookie `sid` (lib/auth SESSION_COOKIE) → verifySession (HMAC, cùng
 *    pattern app hiện hành, không next-auth). Không phiên → redirect /login.
 *    KHÔNG có /in cho role không `sc.xem` (kiểm tra tường minh + core tự gates
 *    baogia.xem / kho.xem / hoso.xem theo module).
 *  - XSS: mọi chuỗi độngrender qua JSX text node → React escape (`<script>` trong
 *    mo_ta trở thành &lt;script&gt;). KHÔNG dùng dangerouslySetInnerHTML.
 */
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { buildApi } from '@/lib/api';
import { can } from '@/lib/perm';
import { db } from '@/lib/db';
import { vnd, isCppType, loadPrintDocs, type PrintDoc, type PrintLine } from '@/lib/print';
import PrintButton from '../../print-button';

export const dynamic = 'force-dynamic';

/** thứ tự mẫu theo bộ hồ sơ 8 bước (in.js) — hiển thị 'Mẫu n/8'. */
const MAU_ORDER: Record<string, number> = {
  kehoach: 1,
  kiemtu: 2,
  baogia: 3,
  nhapkho: 4,
  xuatkho: 5, // p6 nhập cũ/hỏng là biến thể của p4 — không chiếm số riêng
  nghiemthu: 7,
  bangke: 8,
  hoso: 0,
};

/* ── components dựng một trang A4 từ PrintDoc (chỉ nhận dữ liệu ĐÃ escape-by-JSX) ── */

function SoHeader() {
  return (
    <div className="c-header">
      <div className="rep">
        <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b>
        <br />
        Độc lập – Tự do – Hạnh phúc
      </div>
      <div className="org">
        <b>CÔNG TY CP VẬT LIỆU XÂY DỰNG MIỀN TRUNG</b>
        <br />
        cencomOS Gara — quản lý &amp; giám sát xe đầu kéo
      </div>
    </div>
  );
}

function MetaBox({ doc }: { doc: PrintDoc }) {
  return (
    <div className="meta">
      {doc.meta.map((f, i) => (
        <div className="f" key={i}>
          <b>{f.label}:</b>
          <span>{f.value || '—'}</span>
        </div>
      ))}
    </div>
  );
}

function LineTable({ doc }: { doc: PrintDoc }) {
  if (doc.lineStyle === 'full') {
    return (
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Loại</th>
            <th>Tên công việc / Vật tư</th>
            <th>ĐVT</th>
            <th className="num">SL</th>
            <th>Nguyên nhân</th>
            <th>Xử lý</th>
            <th className="num">Đơn giá (đ)</th>
            <th className="num">Thành tiền (đ)</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l: PrintLine, i: number) => (
            <tr key={i}>
              <td>{l.stt}</td>
              <td>{l.loai}</td>
              <td>{l.ten}</td>
              <td>{l.donvi}</td>
              <td className="num">{l.sl}</td>
              <td>{l.nguyen_nhan}</td>
              <td>{l.xu_ly}</td>
              <td className="num">{vnd(l.gia)}</td>
              <td className="num">{vnd(l.thanh)}</td>
            </tr>
          ))}
          {doc.lines.length === 0 && (
            <tr>
              <td colSpan={9}>Không có chi tiết</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>STT</th>
          <th>Tên vật tư</th>
          <th>ĐVT</th>
          <th className="num">SL</th>
          <th className="num">Đơn giá (đ)</th>
          <th className="num">Thành tiền (đ)</th>
        </tr>
      </thead>
      <tbody>
        {doc.lines.map((l: PrintLine, i: number) => (
          <tr key={i}>
            <td>{l.stt}</td>
            <td>{l.ten}</td>
            <td>{l.donvi}</td>
            <td className="num">{l.sl}</td>
            <td className="num">{vnd(l.gia)}</td>
            <td className="num">{vnd(l.thanh)}</td>
          </tr>
        ))}
        {doc.lines.length === 0 && (
          <tr>
            <td colSpan={6}>Không có chi tiết</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function TotalBox({ doc }: { doc: PrintDoc }) {
  return (
    <>
      {doc.totals.map((t, i) => (
        <div className="tong" key={i}>
          <b>
            {t.label}: {t.value}
          </b>
        </div>
      ))}
      <div className="chu">
        <b>Tổng số tiền (viết bằng chữ):</b> {doc.tongChu}
      </div>
    </>
  );
}

function SigBox({ doc }: { doc: PrintDoc }) {
  return (
    <div className="sig">
      {doc.sigs.map((s, i) => (
        <div className="box" key={i}>
          {s}
          <div className="ky">(Ký, ghi rõ họ tên)</div>
        </div>
      ))}
    </div>
  );
}

function StepTable({ steps }: { steps: NonNullable<PrintDoc['steps']> }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Bước</th>
          <th>Nội dung</th>
          <th>Đạt</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((s) => (
          <tr key={s.step}>
            <td>{s.step}</td>
            <td>{s.label}</td>
            <td>
              <span className={s.ok ? 'step-ok' : 'step-bad'}>{s.ok ? 'ĐẠT' : 'THIẾU'}</span>
            </td>
            <td>{s.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SamplePage({ doc }: { doc: PrintDoc }) {
  const mau = MAU_ORDER[doc.type];
  return (
    <section className="a4">
      <SoHeader />
      {mau > 0 && (
        <div className="mau">
          {'Mẫu ' + mau + '/8 — hồ sơ 8 bước sửa chữa'}
        </div>
      )}
      <h1>{doc.title}</h1>
      <div className="so-phieu">{doc.docNumber}</div>
      <MetaBox doc={doc} />
      {doc.missing && doc.missingNote ? <div className="missing">⚠ {doc.missingNote}</div> : null}
      {doc.lines.length > 0 || !doc.missing ? <LineTable doc={doc} /> : null}
      {doc.totals.length > 0 && <TotalBox doc={doc} />}
      {doc.steps && doc.steps.length > 0 && <StepTable steps={doc.steps} />}
      {doc.sigs.length > 0 && <SigBox doc={doc} />}
      {doc.note && <div className="note">{doc.note}</div>}
    </section>
  );
}

/* ── page server: auth + dữ liệu + dựng 1..N trang A4 ── */

function Block({ children }: { children: ReactNode }) {
  return <div className="print-wrap">{children}</div>;
}

export default async function InPrintPage({
  params,
}: {
  params: { type: string; id: string };
}) {
  const typeRaw = String(params?.type ?? '').toLowerCase();
  const idRaw = String(params?.id ?? '');
  if (!isCppType(typeRaw)) notFound();

  // 1) Session: cookie sid (HMAC) — pattern app hiện hành qua helper lib/auth.
  const token = cookies().get(SESSION_COOKIE)?.value;
  const actor = verifySession(token);
  if (!actor) redirect('/login');

  // 2) Quyền sàn của /in: sc.xem — role không có sc.xem KHÔNG có /in (chặn 404-tr_passthru).
  if (!(await can(db, actor.role, 'sc', 'xem'))) notFound();

  // 3) Dữ liệu: TRỰC TIẾP core (lib/print); lỗi 400/403/404 → notFound (không lộ lý do).
  const api = buildApi(actor);
  let docs: PrintDoc[];
  try {
    docs = await loadPrintDocs(api, typeRaw, idRaw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    // Lỗi lập trình (không phải 4xx nghiệp vụ) — cho Next log stack, trả 500 đúng chuẩn.
    if (!/^(400|403|404)|Không tìm thấy/.test(msg)) {
      console.error('[in] loadPrintDocs failed', { type: typeRaw, id: idRaw, err });
      throw err;
    }
    notFound();
  }

  return (
    <Block>
      <PrintButton />
      {docs.map((d, i) => (
        <SamplePage key={i} doc={d} />
      ))}
    </Block>
  );
}
