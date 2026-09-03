/**
 * app/api/export/[type]/route.ts — W4.3 + nâng cấp ExcelJS: GET /api/export/[type] (?id=<chứng từ>)
 *
 * EXPORT THEO MẪU IN — ĐỊNH DẠNG EXCEL THẬT (ExcelJS — dep `exceljs@^4.4.0` đã duyệt
 * trong package.json v5). Trước đây bản tạm CSV-safe; toàn bộ helper CSV
 * (csvCell / toCsvSafe / printDocToCsvRows) VẪN GIỮ nguyên trong lib/print.ts
 * (in_a4 / công cụ CSV khác có thể cần). Contract URL / auth / permission KHÔNG đổi:
 *   - tonghop / tonkho: bảng danh mục (header style, cột tiền #,##0, dòng TỔNG như bản CSV).
 *   - 8 mẫu chứng từ in (isCppType): MỖI PrintDoc một worksheet, dòng flatten qua
 *     printDocToCsvRows — giữ nguyên thứ tự nội dung như bản in A4 (/in).
 * Chống formula-injection phòng thủ nhiều lớp: ô chuỗi bắt đầu `= + - @ TAB CR` → prefix `'`
 * (đúng luật csvCell). xlsx native lưu string là text (không phải <f>formula</f>) nhưng
 * file có thể đi qua tool import tái phân tích — giữ luật escape cho chắc.
 *
 * Auth: cookie `sid` HMAC qua verifySession (pattern app hiện hành — đồng bộ).
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
import ExcelJS from 'exceljs';
import {
  loadPrintDocs,
  printDocToCsvRows,
  isCppType,
  type InType,
} from '@/lib/print';

const log = createScopedLogger('api.export');

export const dynamic = 'force-dynamic';

type CellValue = string | number | null | undefined;

function sidFromRequest(req: Request): string | undefined {
  const raw = req.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Ô Excel an toàn: number giữ nguyên kiểu (không escape); chuỗi bắt đầu `= + - @ \t \r`
 * → prefix `'` (cùng luật với csvCell). null/undefined → rỗng.
 */
function xstr(v: CellValue): string | number {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !s.startsWith("'")) s = "'" + s;
  return s;
}

function textResponse(msg: string, status: number): Response {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** Style header bảng danh mục: nền slate-800, chữ trắng, bold, đóng băng dòng 1. */
function styleHeader(ws: ExcelJS.Worksheet): void {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  h.alignment = { vertical: 'middle' };
  h.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Tên worksheet hợp lệ ExcelJS (≤31 ký tự, cấm [] : * ? / \) — prefix số để unique (mẫu hoso nhiều doc). */
function sheetNameFor(docTitle: string, type: string, idx: number): string {
  const base =
    (docTitle || type)
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || type;
  return `${idx + 1}_${base}`.slice(0, 31);
}

/** Ghi 1 PrintDoc (đã flatten CSV-rows) xuống worksheet; bold title + dòng header 'STT...'. */
function fillPrintSheet(ws: ExcelJS.Worksheet, rows: CellValue[][]): void {
  for (const row of rows) ws.addRow(row.map(xstr));
  // độ rộng cột thoáng cho bản flatten nhiều dạng bảng (6→9 cột)
  const widths = [42, 26, 18, 8, 10, 26, 14, 14, 16];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  if (ws.rowCount >= 1) ws.getRow(1).font = { bold: true, size: 12 };
  for (let r = 1; r <= ws.rowCount; r++) {
    const first = ws.getRow(r).getCell(1).value;
    if (first === 'STT') {
      ws.getRow(r).font = { bold: true };
      ws.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      ws.getRow(r).getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }
  }
}

async function xlsxResponse(wb: ExcelJS.Workbook, filename: string): Promise<Response> {
  const raw: unknown = await wb.xlsx.writeBuffer();
  const bytes = Buffer.isBuffer(raw) ? new Uint8Array(raw) : new Uint8Array(raw as ArrayBuffer);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Export-Format': 'xlsx',
    },
  });
}

/**
 * GĐ6 — chặn "thác nước" export (chuẩn 3a): ExcelJS giữ nguyên workbook trong
 * RAM rồi buffer hóa (peak ~2× dung lượng file) → semaphore in-process 2 slot.
 * On-premise 1 web container = 1 event loop ⇒ đủ chắn CPU/RAM; client nhận 429
 * + Retry-After thì retry sau khi slot trống (không mất dữ, không queue table).
 * Trần dòng nguồn: tonghop/tonkho gọi list-core với limit 20.000 — SC/Vattu lịch
 * sử 10 năm vẫn trọn sổ, còn DB phình quá trần thì trang sau phân trang (TODO
 * export-nhiều-trang khi thực tế chạm 20k).
 */
const EXPORT_MAX_CONCURRENT = 2;
let exportActive = 0;

export async function GET(req: Request, { params }: { params: { type: string } }) {
  const actor = verifySession(sidFromRequest(req));
  if (!actor) {
    return textResponse('Chưa đăng nhập', 401);
  }
  const type = String(params?.type ?? '').toLowerCase();

  // Sàn quyền chung: không sc.xem → không được export chứng từ sửa chữa.
  if (!(await can(db, actor.role, 'sc', 'xem'))) {
    return textResponse('Không đủ quyền', 403);
  }

  if (exportActive >= EXPORT_MAX_CONCURRENT) {
    return new Response('Vượt giới hạn export đồng thời — thử lại sau vài giây', {
      status: 429,
      headers: { 'Retry-After': '5', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  exportActive++;
  const t0 = Date.now();

  const api = buildApi(actor);
  const url = new URL(req.url);
  const idQ = (url.searchParams.get('id') ?? '').trim();
  const today = new Date().toISOString().slice(0, 10);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CencomOS Gara';
  wb.created = new Date();

  try {
    if (type === 'tonghop') {
      // Danh sách SC (core scList: ẩn is_test cho role ngoài admin/giamdoc) + biển số (xeList).
      const [scs, xes] = await Promise.all([
        scList(api, { limit: 20000 }),
        xeList(api, { limit: 20000 }),
      ]);
      const bks = new Map<string, string>();
      for (const x of xes) bks.set(String(x.id), String(x.bien_so ?? ''));
      const ws = wb.addWorksheet('Tổng hợp SC');
      ws.columns = [
        { header: 'Mã SC', key: 'id', width: 14 },
        { header: 'Biển số', key: 'bien_so', width: 14 },
        { header: 'Trạng thái', key: 'trang_thai', width: 16 },
        { header: 'Ngày tạo', key: 'ngay_tao', width: 12 },
        { header: 'Hẹn trả xe', key: 'han_tra_xe', width: 12 },
        { header: 'Tổng CV', key: 'tong_cong', width: 14 },
        { header: 'Tổng VT', key: 'tong_vt', width: 14 },
        { header: 'Tổng cộng', key: 'tong', width: 16 },
      ];
      let tc = 0,
        tv = 0,
        t = 0;
      for (const s of scs) {
        const row = {
          id: xstr(s.id),
          bien_so: xstr(bks.get(String(s.xe_id)) ?? ''),
          trang_thai: xstr(s.trang_thai),
          ngay_tao: xstr(s.ngay_tao ?? ''),
          han_tra_xe: xstr(s.han_tra_xe ?? ''),
          tong_cong: Number(s.tong_cong ?? 0),
          tong_vt: Number(s.tong_vt ?? 0),
          tong: Number(s.tong ?? 0),
        };
        ws.addRow(row);
        tc += row.tong_cong;
        tv += row.tong_vt;
        t += row.tong;
      }
      const totalRow = ws.addRow({
        id: 'TỔNG',
        tong_cong: tc,
        tong_vt: tv,
        tong: t,
      });
      totalRow.font = { bold: true };
      styleHeader(ws);
      for (const key of ['tong_cong', 'tong_vt', 'tong']) {
        const col = ws.getColumn(key);
        if (col) col.numFmt = '#,##0';
      }
      return await xlsxResponse(wb, `tonghop_${today}.xlsx`);
    }

    if (type === 'tonkho') {
      if (!(await can(db, actor.role, 'kho', 'xem'))) {
        return textResponse('Không đủ quyền', 403);
      }
      const vt = await vattuList(api, { limit: 20000 });
      const ws = wb.addWorksheet('Tồn kho');
      ws.columns = [
        { header: 'Mã VT', key: 'id', width: 12 },
        { header: 'Tên vật tư', key: 'ten', width: 32 },
        { header: 'Đơn vị', key: 'don_vi', width: 10 },
        { header: 'Tồn', key: 'ton', width: 10 },
        { header: 'Tồn cũ hỏng', key: 'ton_cu_hong', width: 12 },
        { header: 'Đơn giá', key: 'gia', width: 15 },
        { header: 'Tồn tối thiểu', key: 'ton_min', width: 12 },
      ];
      for (const v of vt) {
        ws.addRow({
          id: xstr(v.id),
          ten: xstr(v.ten ?? ''),
          don_vi: xstr(v.don_vi ?? ''),
          ton: Number(v.ton ?? 0),
          ton_cu_hong: Number(v.ton_cu_hong ?? 0),
          gia: Number(v.gia ?? 0),
          ton_min: Number(v.ton_min ?? 0),
        });
      }
      styleHeader(ws);
      const giaCol = ws.getColumn('gia');
      if (giaCol) giaCol.numFmt = '#,##0';
      return await xlsxResponse(wb, `tonkho_${today}.xlsx`);
    }

    if (isCppType(type)) {
      const t = type as InType;
      if (!idQ) {
        return textResponse('Thiếu ?id=<SC-.../NX-.../BG-...>', 400);
      }
      const docs = await loadPrintDocs(api, t, idQ);
      // hoso = nhiều mẫu → mỗi doc một sheet (kehoach/kiemtu/... 1 doc → 1 sheet).
      docs.forEach((d, i) => {
        const ws = wb.addWorksheet(sheetNameFor(d.title, t, i));
        fillPrintSheet(ws, printDocToCsvRows(d));
      });
      return await xlsxResponse(wb, `${t}_${idQ.toUpperCase()}.xlsx`);
    }

    return textResponse('Loại export không hỗ trợ', 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/^(400|403|404)|Không tìm thấy/.test(msg)) {
      return textResponse(msg, 404);
    }
    log.logError('export failed', err, { type, idQ, actor: actor.id });
    return textResponse('Export lỗi', 500);
  } finally {
    exportActive--;
    // GĐ6: đo thời lượng từng export để phát hiện "DB phình" sớm (WARN khi >5s).
    const ms = Date.now() - t0;
    if (ms > 5000) log.logWarn('export chậm (>5s)', { type, ms, actor: actor.id });
    else log.logInfo('export xong', { type, ms });
  }
}
