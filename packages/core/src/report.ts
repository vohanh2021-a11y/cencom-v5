/**
 * report.ts — Xuất báo cáo Excel (port server/report.js v3.6).
 * Sử dụng exceljs để tạo .xlsx theo bố cục hành chính – kế toán.
 * Gọi handlers: vehicleHealthLog, fleetReport, accountingReport.
 */
import ExcelJS from 'exceljs';
import type { Db } from './db.js';
import * as handlers from './handlers.js';
import * as scoring from './scoring.js';

export interface ReportApi {
  db: Db;
}

const GREEN = '0E5A37';
const GREEN2 = '12794A';
const HEAD_TX = 'FFFFFF';
const LINE = 'D5DDD5';
const SCALEFILL = { A: 'DCFCE7', B: 'ECFCCB', C: 'FEF9C3', D: 'FFEDD5', E: 'FEE2E2' };
const FONT = 'Times New Roman';

function applyFont(ws: ExcelJS.Worksheet) {
  ws.eachRow({ includeEmpty: false }, (r: ExcelJS.Row) => {
    r.eachCell({ includeEmpty: false }, (c: ExcelJS.Cell) => {
      const cur = (c.font && typeof c.font === 'object') ? c.font : {};
      c.font = Object.assign({}, cur, { name: FONT, size: cur.size || 12 });
    });
  });
}

function todayVN(): string {
  const d = new Date();
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
}

function stateInfo(trangThai: string): { label: string; fill: string } {
  const x = String(trangThai || '').replace(/\s/g, '').toLowerCase();
  if (x.indexOf('hoạtđộng') >= 0) return { label: 'Hoạt động', fill: 'E4F6EC' };
  if (x.indexOf('dựphòng') >= 0) return { label: 'Dự phòng', fill: 'EAF3FF' };
  if (x.indexOf('thanhlý') >= 0) return { label: 'Thanh lý', fill: 'FDE8E7' };
  if (x.indexOf('bảolý') >= 0 || x.indexOf('bảohành') >= 0) return { label: 'Bảo lý', fill: 'FFF3E0' };
  return { label: trangThai || '—', fill: 'FFFFFF' };
}

function borderCell(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: LINE } },
    bottom: { style: 'thin', color: { argb: LINE } },
    left: { style: 'thin', color: { argb: LINE } },
    right: { style: 'thin', color: { argb: LINE } }
  };
}

function setFill(cell: ExcelJS.Cell, hex: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hex } };
}

function letterhead(ws: ExcelJS.Worksheet, w: number) {
  const half = Math.floor(w / 2);
  ws.mergeCells(1, 1, 2, half);
  ws.getCell(1, 1).value = 'C��NG H��A XÃ H��I CH�� NGH��A VI��T NAM';
  ws.getCell(2, 1).value = 'Độc lập – Tự do – Hạnh phúc';
  ws.getCell(1, 1).font = { bold: true, size: 12, color: { argb: GREEN } };
  ws.getCell(2, 1).font = { size: 11, underline: true, color: { argb: GREEN } };

  ws.mergeCells(1, half + 1, 2, w);
  ws.getCell(1, half + 1).value = 'C��NG TY CP V��T LI��U XD MI��N TRUNG';
  ws.getCell(2, half + 1).value = 'Phòng Xe máy Thiết bị';
  ws.getCell(1, half + 1).font = { bold: true, size: 12, color: { argb: GREEN } };
  ws.getCell(2, half + 1).font = { bold: true, size: 12, color: { argb: GREEN } };
  ws.getCell(1, half + 1).alignment = { horizontal: 'right' };
  ws.getCell(2, half + 1).alignment = { horizontal: 'right' };
  [1, 2].forEach((r) => {
    for (let c = 1; c <= w; c++) borderCell(ws.getCell(r, c));
  });
  ws.addRow([]);
}

function titleRow(ws: ExcelJS.Worksheet, w: number, text: string, sub?: string) {
  const r1 = ws.rowCount + 1;
  ws.mergeCells(r1, 1, r1, w);
  ws.getCell(r1, 1).value = text;
  ws.getCell(r1, 1).font = { bold: true, size: 16, color: { argb: GREEN } };
  ws.getCell(r1, 1).alignment = { horizontal: 'center' };
  if (sub) {
    const r2 = ws.rowCount + 1;
    ws.mergeCells(r2, 1, r2, w);
    ws.getCell(r2, 1).value = sub;
    ws.getCell(r2, 1).alignment = { horizontal: 'center' };
    ws.getCell(r2, 1).font = { size: 11, color: { argb: '5E6B7F' } };
  }
  ws.addRow([]);
}

function sectionRow(ws: ExcelJS.Worksheet, w: number, text: string) {
  const r = ws.rowCount + 1;
  ws.mergeCells(r, 1, r, w);
  ws.getCell(r, 1).value = text;
  ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: HEAD_TX } };
  setFill(ws.getCell(r, 1), GREEN);
  ws.getRow(r).height = 22;
  ws.addRow([]);
}

function headRow(ws: ExcelJS.Worksheet, labels: string[]) {
  const r = ws.addRow(labels);
  r.font = { bold: true, color: { argb: HEAD_TX }, size: 11 };
  r.eachCell((c: ExcelJS.Cell) => {
    setFill(c, GREEN2);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    borderCell(c);
  });
  ws.getRow(r.number).height = 20;
  return r;
}

function signatureBlock(ws: ExcelJS.Worksheet, w: number) {
  ws.addRow([]);
  const half = Math.floor(w / 3);
  const r = ws.addRow([]);
  const labels = ['Người lập biểu', 'Phụ trách PT-TBG', 'Giám đốc'];
  for (let i = 0; i < 3; i++) {
    const c1 = i * half + 1;
    const c2 = i === 2 ? w : (i + 1) * half;
    ws.mergeCells(r.number, c1, r.number + 2, c2);
    ws.getCell(r.number, c1).value = labels[i];
    ws.getCell(r.number, c1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(r.number, c1).font = { bold: true, size: 11 };
  }
  ws.getRow(r.number).height = 52;
  const dr = ws.rowCount + 1;
  ws.mergeCells(dr, 1, dr, w);
  ws.getCell(dr, 1).value = 'Ngày ' + todayVN() + ' | QL-Garage CENCOM – GĐ3 (SQL · tự hosting)';
  ws.getCell(dr, 1).alignment = { horizontal: 'center' };
  ws.getCell(dr, 1).font = { size: 10, color: { argb: '5E6B7F' } };
}

function dmy(iso: string | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return (d ? Number(d) : '') + '/' + (m ? Number(m) : '') + '/' + (y || '');
}

/* ---------- Sheet lý lịch sức khỏe 1 xe ---------- */
async function makeLylicheSheet(
  wb: ExcelJS.Workbook,
  bks: string,
  api: ReportApi
) {
  const h = await handlers.vehicleHealthLog(api, bks);
  if (!h) return null;
  const x = await api.db.xeByBks(bks);
  if (!x) return null;

  const phieu = await Promise.all((await api.db.phieuByBks(bks)).map(async (p) => {
    const vals: Record<number, string> = {};
    (await api.db.ketQuaByPhieu(p.id)).forEach((k) => { vals[k.item_id] = k.value; });
    const score = scoring.scoreVehicle(await api.db.bieuMaGroups(), vals);
    return {
      id: p.id, ngay: p.ngay, nguoi: p.nguoi, mode: p.mode,
      soMuc: Object.keys(vals).length,
      e: Object.keys(vals).filter((k) => vals[Number(k)] === 'E').length,
      avg: score.avg
    };
  }));

  const ws = wb.addWorksheet('LL_' + bks.replace(/\W+/g, '').slice(0, 18), { views: [{ showGridLines: false }] });
  ws.columns = [
    { key: 'a', width: 3 }, { key: 'b', width: 18 }, { key: 'c', width: 6 },
    { key: 'd', width: 36 }, { key: 'e', width: 10 }, { key: 'f', width: 14 },
    { key: 'g', width: 12 }, { key: 'h', width: 12 }, { key: 'i', width: 26 }
  ];
  const W = ws.columns.length;

  letterhead(ws, W);
  titleRow(ws, W, 'L�� L��CH S��C KH��E XE',
    'Biển số ' + x.bks + ' — ' + (x.hang || '') + ' ' + (x.dong || '') + ' — Năm SX ' + (x.nam_sx || '—') + ' — ' + (x.loai_pt || ''));

  // 1. Thông tin xe
  sectionRow(ws, W, '1. TH��NG TIN XE');
  [
    ['Biển số', x.bks, 'Biển số cũ', x.bien_so_cu || '—'],
    ['Hãng / Dòng', (x.hang || '') + (x.dong ? ' ' + x.dong : ''), 'Loại PT', x.loai_pt || ''],
    ['Năm sản xuất', x.nam_sx || '—', 'Phòng ban', x.phong_ban || '—'],
    ['Lái xe', x.lai_xe || '—', 'Trạng thái', x.trang_thai || '—']
  ].forEach((row) => {
    const r = ws.addRow([row[0], row[1], row[2], row[3], '', '', '', '', '']);
    r.getCell(1).font = { bold: true };
    r.getCell(3).font = { bold: true };
    [1, 3].forEach((c) => r.getCell(c).alignment = { vertical: 'middle' });
  });

  // 2. Lịch sử phiếu
  sectionRow(ws, W, '2. L��CH S�� PHI��U KI��M TRA (' + phieu.length + ' phiếu)');
  headRow(ws, ['STT', 'Số phiếu', 'Ngày', 'Người lập', 'Chế độ', 'Số mục', 'Mục E', 'Điểm TB', '']);
  phieu.forEach((p, i) => {
    const r = ws.addRow([i + 1, p.id, p.ngay || '', p.nguoi || '', p.mode || '', p.soMuc, p.e, p.avg || 0, '']);
    r.getCell(1).alignment = { horizontal: 'center' };
    if (p.e) setFill(r.getCell(7), 'FEE2E2');
    r.eachCell(borderCell);
  });
  if (!phieu.length) ws.addRow(['Chưa có phiếu kiểm tra cho xe này.']);

  // 3. Sức khỏe từng bộ phận
  sectionRow(ws, W, '3. S��C KH��E T��NG B�� PH��N (tổng hợp các lần khám)');
  headRow(ws, ['STT', 'Hệ thống', 'Mã', 'Mục', 'Số lần', 'Gần nhất', 'Xấu nhất', 'Xu hướng', 'Ghi chú cuối']);
  let stt = 0;
  (h.groups as Array<{ name: string; items: Array<Record<string, unknown>> }>).forEach((g) => {
    (g.items as Array<Record<string, unknown>>).forEach((it) => {
      stt++;
      const last = it.last ? (String((it.last as any).value) + ' · ' + ((it.last as any).ngay || '')) : '—';
      const r = ws.addRow([stt, g.name, it.item_id, it.name, it.count, last, it.worst || '—', it.trend || '—', it.last ? String((it.last as any).ghi_chu || '') : '']);
      r.getCell(1).alignment = { horizontal: 'center' };
      r.getCell(3).alignment = { horizontal: 'center' };
      r.getCell(5).alignment = { horizontal: 'center' };
      if (it.worst) setFill(r.getCell(7), SCALEFILL[(it.worst as any) as keyof typeof SCALEFILL] || 'FFFFFF');
      if (it.last && SCALEFILL[((it.last as any).value as any) as keyof typeof SCALEFILL]) setFill(r.getCell(6), SCALEFILL[((it.last as any).value as any) as keyof typeof SCALEFILL]);
      r.eachCell(borderCell);
    });
  });

  ws.addRow([]);
  const nr = ws.rowCount + 1;
  ws.mergeCells(nr, 1, nr, W);
  ws.getCell(nr, 1).value = 'Ghi chú: thang A–E, trong đó E = kém/nguy hiểm cần xử lý ưu tiên.';
  ws.getCell(nr, 1).font = { italic: true, size: 10, color: { argb: '5E6B7F' } };

signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Sheet chi tiết các lần khám ---------- */
async function chiTietSheet(
  wb: ExcelJS.Workbook,
  bks: string,
  api: ReportApi
) {
  const groupNames: Record<number, string> = {};
  const itemNames: Record<number, string> = {};
  (await api.db.bieuMaGroups()).forEach((g) => {
    groupNames[g.group_id] = g.name;
    g.items.forEach((it) => { itemNames[it.item_id] = it.name; });
  });
  const sh = wb.addWorksheet('CHITIET_' + bks.replace(/\W+/g, '').slice(0, 16));
  sh.columns = [
    { key: 'a', width: 3 }, { key: 'b', width: 12 }, { key: 'c', width: 11 },
    { key: 'd', width: 18 }, { key: 'e', width: 5 }, { key: 'f', width: 36 },
    { key: 'g', width: 8 }, { key: 'h', width: 28 }
  ];
  headRow(sh, ['STT', 'Số phiếu', 'Ngày', 'Hệ thống', 'Mã', 'Hạng mục', 'Mức', 'Ghi chú']);
  let i = 0;
  (await api.db.ketQuaByBks(bks)).forEach((k) => {
    i++;
    const r = sh.addRow([
      i, k.phieu_id, k.ngay || '', groupNames[k.group_id] || '', k.item_id,
      itemNames[k.item_id] || ('Mục ' + k.item_id), k.value || '', k.ghi_chu || ''
    ]);
    if (SCALEFILL[k.value as keyof typeof SCALEFILL]) setFill(r.getCell(7), SCALEFILL[k.value as keyof typeof SCALEFILL]);
    r.eachCell(borderCell);
  });
  if (i) sh.autoFilter = { from: 'A1', to: 'H' + (i + 1) };
  applyFont(sh);
}

/* ---------- Báo cáo đội xe ---------- */
export async function buildFleetWorkbook(
  api: ReportApi,
  bksList: string[]
): Promise<Buffer<ArrayBufferLike>> {
  const fr = await handlers.fleetReport(api);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('T��NG H��P', { views: [{ showGridLines: false }] });
  const W = 11;
  ws.columns = [
    { key: 'a', width: 4 }, { key: 'b', width: 13 }, { key: 'c', width: 11 }, { key: 'd', width: 7 },
    { key: 'e', width: 5 }, { key: 'f', width: 20 }, { key: 'g', width: 12 }, { key: 'h', width: 7 },
    { key: 'i', width: 10 }, { key: 'j', width: 8 }, { key: 'k', width: 12 }
  ];

  letterhead(ws, W);
  titleRow(ws, W, 'BÁO CÁO T��NH TR��NG Đ��I XE', 'Ngày lập: ' + todayVN() + ' · Phòng Xe máy Thiết bị');

  sectionRow(ws, W, 'T��NG QUAN');
  const k = fr.kpi as Record<string, unknown>;
  ws.addRow([k.vehCount + ' xe', k.hoatDong + ' đang hoạt động', k.duPhong + ' dự phòng', k.thanhLy + ' thanh lý', k.phieuCount + ' phiếu KT', k.eTotal + ' mục E tồn', '', '', '', '', '']);

  sectionRow(ws, W, 'PHÂN THEO PH��NG BAN');
  headRow(ws, ['STT', 'Phòng ban', 'Số xe']);
  Object.entries(fr.byPhong as Record<string, number>).forEach(([nm, cnt], i) => ws.addRow([i + 1, nm, cnt]));

  sectionRow(ws, W, 'PHÂN THEO HÃNG');
  headRow(ws, ['STT', 'Hãng', 'Số xe']);
  Object.entries(fr.byHang as Record<string, number>).forEach(([nm, cnt], i) => ws.addRow([i + 1, nm, cnt]));

  sectionRow(ws, W, 'B��NG T��NH TR��NG T��NG XE');
  headRow(ws, ['STT', 'BKS', 'Hãng', 'Dòng', 'Năm', 'Phòng ban', 'Trạng thái', 'Phiếu', 'Điểm TB', 'E mới', 'Xu hướng']);
  let stt = 0;
  (fr.perVehicle as Array<Record<string, unknown>>).filter((v) => bksList.includes(String(v.bks))).forEach((v) => {
    stt++;
    const st = stateInfo(String(v.trang_thai));
    const r = ws.addRow([stt, v.bks, v.hang, v.dong || '—', v.nam_sx || '', v.phong_ban, st.label, v.soPhieu, v.lastAvg == null ? '—' : v.lastAvg, v.lastE || 0, v.trend]);
    r.getCell(2).font = { bold: true, color: { argb: GREEN2 } };
    setFill(r.getCell(7), st.fill);
    r.eachCell(borderCell);
  });
  if (!stt) ws.addRow(['Không có xe trong danh sách đã chọn.']);

  signatureBlock(ws, W);
  applyFont(ws);

  // Lý lịch từng xe trong cùng file
  for (const b of bksList) {
    if (!(await api.db.xeByBks(b))) continue;
    await makeLylicheSheet(wb, b, api);
    await chiTietSheet(wb, b, api);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Lý lịch 1 xe (file đơn) ---------- */
export async function buildVehicleWorkbook(
  api: ReportApi,
  bks: string
): Promise<Buffer<ArrayBufferLike>> {
  const xe = await api.db.xeByBks(bks);
  if (!xe) throw new Error('Không có xe ' + bks);
  const wb = new ExcelJS.Workbook();
  await makeLylicheSheet(wb, bks, api);
  await chiTietSheet(wb, bks, api);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Báo cáo kế toán tháng/quý ---------- */
export async function buildAccountingWorkbook(
  api: ReportApi,
  from: string,
  to: string,
  group: 'month' | 'quarter'
): Promise<Buffer<ArrayBufferLike>> {
  const acct = await handlers.accountingReport(api, { from, to, group });
  const grpLabel = group === 'quarter' ? 'QU��' : 'THÁNG';
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('K�� TOÁN ' + grpLabel, { views: [{ showGridLines: false }] });
  const W = 10;
  ws.columns = [
    { key: 'a', width: 18 }, { key: 'b', width: 10 }, { key: 'c', width: 8 }, { key: 'd', width: 14 },
    { key: 'e', width: 9 }, { key: 'f', width: 9 }, { key: 'g', width: 8 }, { key: 'h', width: 9 },
    { key: 'i', width: 13 }, { key: 'j', width: 6 }
  ];
  letterhead(ws, W);
  titleRow(ws, W, 'BÁO CÁO K�� TOÁN KI��M TRA THEO ' + grpLabel,
    'Từ ngày ' + (dmy(from) || '…') + ' đến ngày ' + (dmy(to) || '…') + ' · Phòng Xe máy Thiết bị');

  sectionRow(ws, W, 'T��NG H��P S�� PHI��U / M��C ĐÁNH GIÁ');
  headRow(ws, ['Kỳ', 'Số phiếu', 'Số xe', 'Số mục đánh giá', 'Mục E', 'Mục D', '% E', 'Điểm TB', 'Phiếu hoàn thành', '']);
  (acct.buckets as Array<Record<string, unknown>>).forEach((b) => {
    const r = ws.addRow([b.label, b.phieu, b.xe, b.soMuc, b.eCount, b.dCount, b.pctE + '%', b.avg == null ? '—' : b.avg, b.hoanThanh, '']);
    if (b.eCount) setFill(r.getCell(5), 'FEE2E2');
    r.eachCell(borderCell);
  });
  if (!(acct.buckets as Array<unknown>).length) ws.addRow(['Không có phiếu kiểm tra trong khoảng thời gian này.']);
  const tot = acct.totals as Record<string, unknown>;
  const tr = ws.addRow(['Tổng cộng', tot.phieu, tot.xe, tot.soMuc, tot.eCount, tot.dCount, tot.pctE + '%', tot.avg == null ? '—' : tot.avg, tot.hoanThanh, '']);
  tr.font = { bold: true };
  tr.eachCell(borderCell);

  // Chi tiết từng phiếu trong kỳ
  const dt = wb.addWorksheet('CHI TI��T PHI��U');
  dt.columns = [
    { key: 'a', width: 4 }, { key: 'b', width: 16 }, { key: 'c', width: 13 }, { key: 'd', width: 11 },
    { key: 'e', width: 11 }, { key: 'f', width: 14 }, { key: 'g', width: 18 }, { key: 'h', width: 18 },
    { key: 'i', width: 14 }, { key: 'j', width: 8 }, { key: 'k', width: 7 }, { key: 'l', width: 7 },
    { key: 'm', width: 9 }
  ];
  headRow(dt, ['STT', 'Kỳ', 'Số phiếu', 'BKS', 'Ngày', 'Chế độ', 'Người lập', 'Thợ phụ trách', 'Trạng thái', 'Số mục', 'E', 'D', 'Điểm TB']);
  (acct.detail as Array<Record<string, unknown>>).forEach((p, i) => {
    const r = dt.addRow([i + 1, p.periodLabel, p.id, p.bks, dmy(String(p.ngay)), p.mode, p.nguoi, p.assignee, p.trang_thai, p.soMuc, p.eCount, p.dCount, p.avg == null ? '—' : p.avg]);
    if (p.eCount) setFill(r.getCell(11), 'FEE2E2');
    r.eachCell(borderCell);
  });
  if ((acct.detail as Array<unknown>).length) dt.autoFilter = { from: 'A1', to: 'M' + ((acct.detail as Array<unknown>).length + 1) };
  applyFont(dt);

  signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Báo cáo tồn kho ---------- */
export async function buildTonKhoWorkbook(api: ReportApi): Promise<Buffer<ArrayBufferLike>> {
  const rows = await api.db.rows<Record<string, unknown>>("SELECT * FROM vattu WHERE deleted_at='' ORDER BY nhom, name");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('T��N KHO', { views: [{ showGridLines: false }] });
  const W = 8;
  ws.columns = [
    { key: 'a', width: 5 }, { key: 'b', width: 28 }, { key: 'c', width: 12 }, { key: 'd', width: 10 },
    { key: 'e', width: 12 }, { key: 'e2', width: 14 }, { key: 'f', width: 12 }, { key: 'g', width: 12 }, { key: 'h', width: 20 }
  ];
  letterhead(ws, W);
  titleRow(ws, W, 'BÁO CÁO T��N KHO V��T T��', 'Ngày ' + todayVN() + ' · Phòng Xe máy Thiết bị');
  headRow(ws, ['STT', 'Tên vật tư', 'Nhóm', 'Đơn vị', 'Tồn hiện tại', 'Tồn hư hỏng', 'Tồn tối thiểu', 'Đơn giá', 'Ghi chú']);
  rows.forEach((v, i) => {
    const r = ws.addRow([i + 1, v.name, v.nhom || '', v.donvi || '', v.ton, v.ton_cu_hong, v.ton_min, v.gia, '']);
    if (Number(v.ton) < Number(v.ton_min)) setFill(r.getCell(5), 'FEE2E2');
    if ((Number(v.ton_cu_hong) || 0) > 0) setFill(r.getCell(6), 'FFF3CD');
    r.eachCell(borderCell);
  });
  if (!rows.length) ws.addRow(['Không có vật tư trong kho.']);
  const totalTon = rows.reduce((a, v) => a + Number(v.ton || 0), 0);
  const totalHh = rows.reduce((a, v) => a + Number(v.ton_cu_hong || 0), 0);
  const totalGia = rows.reduce((a, v) => a + Number(v.ton || 0) * Number(v.gia || 0), 0);
  const tot = ws.addRow(['', 'T��NG C��NG', '', '', totalTon, totalHh, '', totalGia, '']);
  tot.font = { bold: true };
  tot.eachCell(borderCell);
  signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Phiếu xuất kho ---------- */
export async function buildPhXuatWorkbook(api: ReportApi, phId: string): Promise<Buffer<ArrayBufferLike>> {
  const ph = await api.db.row<Record<string, unknown>>("SELECT * FROM phieu_xuat WHERE id=$1 AND deleted_at=''", phId);
  if (!ph) throw new Error('Không thấy phiếu xuất.');
  const ct = await api.db.rows<Record<string, unknown>>(
    "SELECT c.*, v.name, v.donvi FROM phieu_xuat_ct c LEFT JOIN vattu v ON c.vattu_id=v.id WHERE c.ph_id=$1 AND c.deleted_at=''", phId
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PHI��U XU��T', { views: [{ showGridLines: false }] });
  const W = 7;
  ws.columns = [
    { key: 'a', width: 5 }, { key: 'b', width: 28 }, { key: 'c', width: 10 }, { key: 'd', width: 8 },
    { key: 'e', width: 14 }, { key: 'f', width: 14 }, { key: 'g', width: 14 }
  ];
  letterhead(ws, W);
  const isHh = ph.loai_xuat === 'cu_hong';
  titleRow(ws, W, isHh ? 'PHI��U XU��T THANH L�� KHO H�� H��NG' : 'PHI��U XU��T KHO', String(ph.id) + ' · Ngày ' + dmy(String(ph.ngay)) + ' · Người lập: ' + String(ph.nguoi_lap || ''));
  ws.addRow(['Kho:', isHh ? 'Đồ hư hỏng (thanh lý)' : 'Đồ dùng']);
  if (ph.ref_sc) { ws.addRow(['Phiếu sửa chữa:', ph.ref_sc]); ws.addRow([]); }
  headRow(ws, ['STT', 'Vật tư', 'Số lượng', 'ĐV', 'Đơn giá', 'Thành tiền', '']);
  ct.forEach((c, i) => {
    const r = ws.addRow([i + 1, c.name || '?', c.so_luong, c.donvi || '', c.dgia, c.thanh, '']);
    r.eachCell(borderCell);
  });
  const tot = ws.addRow(['', 'T��NG C��NG', '', '', '', ct.reduce((a, c) => a + Number(c.thanh || 0), 0), '']);
  tot.font = { bold: true };
  tot.eachCell(borderCell);
  signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Quyết toán sửa chữa ---------- */
export async function buildQuyetToanWorkbook(api: ReportApi, scId: string): Promise<Buffer<ArrayBufferLike>> {
  const sc = await api.db.row<Record<string, unknown>>("SELECT * FROM phieu_sua WHERE id=$1 AND deleted_at=''", scId);
  if (!sc) throw new Error('Không thấy phiếu sửa chữa.');
  const cv = await api.db.rows<Record<string, unknown>>("SELECT * FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''", scId);
  const vt = await api.db.rows<Record<string, unknown>>("SELECT c.*, v.name, v.donvi FROM sc_vattu c LEFT JOIN vattu v ON c.vattu_id=v.id WHERE c.sc_id=$1 AND c.deleted_at=''", scId);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('QUY��T TOÁN', { views: [{ showGridLines: false }] });
  const W = 8;
  ws.columns = [
    { key: 'a', width: 5 }, { key: 'b', width: 30 }, { key: 'c', width: 14 }, { key: 'd', width: 10 },
    { key: 'e', width: 12 }, { key: 'f', width: 12 }, { key: 'g', width: 12 }, { key: 'h', width: 10 }
  ];
  letterhead(ws, W);
  titleRow(ws, W, 'QUY��T TOÁN S��A CH��A', String(sc.id) + ' · BKS ' + String(sc.bks) + ' · Ngày ' + dmy(String(sc.ngay)));
  sectionRow(ws, W, 'C��NG VI��C');
  headRow(ws, ['STT', 'Hạng mục', 'Đơn giá', 'Trạng thái', '', '', '', '']);
  cv.forEach((c, i) => {
    const r = ws.addRow([i + 1, String(c.ten || c.name || '?'), c.don_gia, c.tt, '', '', '', '']);
    r.eachCell(borderCell);
  });
  ws.addRow([]);
  sectionRow(ws, W, 'V��T T��');
  headRow(ws, ['STT', 'Vật tư', 'SL', 'ĐV', 'Đơn giá', 'Thành tiền', 'Xuất kho', '']);
  vt.forEach((c, i) => {
    const r = ws.addRow([i + 1, String(c.name || '?'), c.so_luong, c.donvi || '', c.don_gia, Number(c.so_luong) * Number(c.don_gia), c.tt === 'da_xuat' ? 'Rồi' : 'Chưa', '']);
    r.eachCell(borderCell);
  });
  const tongCv = cv.reduce((a, c) => a + Number(c.don_gia || 0), 0);
  const tongVt = vt.reduce((a, c) => a + Number(c.so_luong || 0) * Number(c.don_gia || 0), 0);
  ws.addRow([]);
  const tot = ws.addRow(['', 'T��NG C��NG VI��C', tongCv, '', '', '', '', '']);
  tot.font = { bold: true }; tot.eachCell(borderCell);
  const tot2 = ws.addRow(['', 'T��NG V��T T��', tongVt, '', '', '', '', '']);
  tot2.font = { bold: true }; tot2.eachCell(borderCell);
  const gt = ws.addRow(['', 'T��NG C��NG', tongCv + tongVt, '', '', '', '', '']);
  gt.font = { bold: true }; gt.eachCell(borderCell);
  signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}

/* ---------- Báo cáo yêu cầu thăm khám ---------- */
const TK_TT_LABEL: Record<string, string> = {
  'cho_duyet': 'Chờ quản lý duyệt', 'da_duyet': 'Đã duyệt — chờ xưởng', 'tu_choi': 'Quản lý từ chối',
  'xuong_nhan': 'Xưởng đã nhận', 'xuong_tu_choi': 'Xưởng từ chối', 'da_giao_tho': 'Đã giao th��',
  'dang_thuc_hien': 'Đang thực hiện', 'da_hoan': 'Hoàn tất', 'da_huy': 'Đã hủy'
};
const TK_UU_LABEL: Record<string, string> = { Khan_cap: 'Khẩn cấp', Xu_ly_som: 'Xử lý sớm', Binh_thuong: 'Bình thường' };

export async function buildTkWorkbook(api: ReportApi): Promise<Buffer<ArrayBufferLike>> {
  const rows = await api.db.rows<Record<string, unknown>>("SELECT * FROM yeu_cau_tham_kham WHERE deleted_at='' ORDER BY ngay DESC, id DESC");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Y��U C��U THĂM KHÁM', { views: [{ showGridLines: false }] });
  const W = 11;
  ws.columns = [
    { key: 'a', width: 14 }, { key: 'b', width: 13 }, { key: 'c', width: 15 }, { key: 'd', width: 11 },
    { key: 'e', width: 12 }, { key: 'f', width: 14 }, { key: 'g', width: 34 }, { key: 'h', width: 13 },
    { key: 'i', width: 16 }, { key: 'j', width: 13 }, { key: 'k', width: 13 }, { key: 'l', width: 13 }
  ];
  letterhead(ws, W);
  titleRow(ws, W, 'BÁO CÁO Y��U C��U THĂM KHÁM S��A CH��A',
    'Phòng Xe máy Thiết bị · Xuất lúc ' + todayVN());
  headRow(ws, ['Mã yêu cầu', 'Ngày', 'Biển số', 'Lái xe', '��u tiên', 'Dấu hiệu', 'Mô tả', 'Trạng thái', 'Quản lý duyệt', 'Xưởng', 'Thợ', 'Phiếu SC']);
  rows.forEach((r) => {
    let dauHieu = '';
    try { const a = JSON.parse(String(r.dau_hieu || '[]')); dauHieu = (Array.isArray(a) ? a : []).join(', '); } catch (e) { dauHieu = ''; }
    const row = ws.addRow([
      r.id, dmy(String(r.ngay)), r.bks, r.lai_xe, TK_UU_LABEL[String(r.muc_uu_tien)] || String(r.muc_uu_tien) || '',
      dauHieu, String(r.mo_ta || ''), TK_TT_LABEL[String(r.trang_thai)] || String(r.trang_thai),
      String(r.nguoi_duyet || ''), String(r.nguoi_xuong || ''), String(r.tho_id || ''), String(r.sc_id || '')
    ]);
    row.eachCell(borderCell);
  });
  if (rows.length) ws.autoFilter = { from: 'A1', to: 'L' + (rows.length + 1) };
  signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer<ArrayBufferLike>;
}