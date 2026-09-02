/**
 * app/api/export/[type]/route.ts — W4.3: GET /api/export/[type] (?id=<chứng từ>)
 *
 * EXPORT THEO MẪU IN. HIỆN TẠI = CSV-SAFE (BOM UTF-8, escape RFC4180 + chặn
 * formula-injection `= + - @`).lý do: package.json v5 KHÔNG có `xlsx`/`exceljs`
 * và task cấm `npm i`. TODO (khi coordinator duyệt thêm dep): đổi sang workbook
 * `exceljs`, giữ nguyên contract URL + auth + permission.
 *
 * Auth: cookie `sid` HMAC qua verifySession (pattern app hiện hành).
 * Quyền: sàn sc.xem cho mọi loại export (đồng bộ cổng /in W4.3); tonkho additionally
 * cần kho.xem; type per-sample tự gate bên trong lib/print (core checks).
 */
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { buildApi } from '@/lib/api';
import { can } from '@/lib/perm';
import { db } from '@/lib/db';
import { scList } from '@/lib/core/sc';
import { xeList } from '@/lib/core/xe';
import { vattuList } from '@/lib/core/kho';
import { createScopedLogger } from '@/lib/observability';
import {
  loadPrintDocs,
  printDocToCsvRows,
  toCsvSafe,
  isCppType,
  type InType,
} from '@/lib/print';

const log = createScopedLogger('api.export');

export const dynamic = 'force-dynamic';

function sidFromRequest(req: Request): string | undefined {
  const raw = req.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      // TODO(xlsx): chuyển sang application/vnd.openxmlformats-...sheet khi có dep;
      // giữ nguyên URL + tên file (.xlsx) cho client không đổi code.
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Export-Format': 'csv',
    },
  });
}

export async function GET(req: Request, { params }: { params: { type: string } }) {
  const actor = verifySession(sidFromRequest(req));
  if (!actor) {
    return new Response('Chưa đăng nhập', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const type = String(params?.type ?? '').toLowerCase();

  // Sàn quyền chung: không sc.xem → không được export chứng từ sửa chữa.
  if (!(await can(db, actor.role, 'sc', 'xem'))) {
    return new Response('Không đủ quyền', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const api = buildApi(actor);
  const url = new URL(req.url);
  const idQ = (url.searchParams.get('id') ?? '').trim();
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (type === 'tonghop') {
      // Danh sách SC (core scList: ẩn is_test cho role ngoài admin/giamdoc) + biển số (xeList).
      const [scs, xes] = await Promise.all([scList(api), xeList(api)]);
      const bks = new Map<string, string>();
      for (const x of xes) bks.set(String(x.id), String(x.bien_so ?? ''));
      const rows: (string | number | null | undefined)[][] = [
        ['id', 'bien_so', 'trang_thai', 'ngay_tao', 'han_tra_xe', 'tong_cong', 'tong_vt', 'tong'],
      ];
      let tc = 0, tv = 0, t = 0;
      for (const s of scs) {
        rows.push([
          s.id,
          bks.get(String(s.xe_id)) ?? '',
          s.trang_thai,
          s.ngay_tao ?? '',
          s.han_tra_xe ?? '',
          Number(s.tong_cong ?? 0),
          Number(s.tong_vt ?? 0),
          Number(s.tong ?? 0),
        ]);
        tc += Number(s.tong_cong ?? 0);
        tv += Number(s.tong_vt ?? 0);
        t += Number(s.tong ?? 0);
      }
      rows.push([]);
      rows.push(['TỔNG', '', '', '', '', tc, tv, t]);
      return csvResponse(toCsvSafe(rows), `tonghop_${today}.csv`);
    }

    if (type === 'tonkho') {
      if (!(await can(db, actor.role, 'kho', 'xem'))) {
        return new Response('Không đủ quyền', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const vt = await vattuList(api);
      const rows: (string | number | null | undefined)[][] = [['id', 'ten', 'don_vi', 'ton', 'ton_cu_hong', 'gia', 'ton_min']];
      for (const v of vt) {
        rows.push([
          v.id,
          v.ten ?? '',
          v.don_vi ?? '',
          Number(v.ton ?? 0),
          Number(v.ton_cu_hong ?? 0),
          Number(v.gia ?? 0),
          Number(v.ton_min ?? 0),
        ]);
      }
      return csvResponse(toCsvSafe(rows), `tonkho_${today}.csv`);
    }

    if (isCppType(type)) {
      const t = type as InType;
      if (!idQ) {
        return new Response('Thiếu ?id=<SC-.../NX-.../BG-...>', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const docs = await loadPrintDocs(api, t, idQ);
      const rows: (string | number | null | undefined)[][] = [];
      for (const d of docs) {
        if (rows.length) rows.push([]);
        rows.push(...printDocToCsvRows(d));
      }
      return csvResponse(toCsvSafe(rows), `${t}_${idQ.toUpperCase()}.csv`);
    }

    return new Response('Loại export không hỗ trợ', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/^(400|403|404)|Không tìm thấy/.test(msg)) {
      return new Response(msg, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    log.logError('export failed', err, { type, idQ, actor: actor.id });
    return new Response('Export lỗi', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
