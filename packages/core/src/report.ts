/**
 * report.ts — Xuất báo cáo Excel (port server/report.js v3.6).
 * Sử dụng exceljs để tạo .xlsx theo bố cục hành chính – kế toán.
 * GĐ4 (theo plan_erase_1): đã bỏ các báo cáo sức khỏe xe dùng bảng kiem_tra/ket_qua/bieu_ma
 * (module Thăm khám TK). Giữ báo cáo tồn kho, phiếu xuất, quyết toán và thêm báo cáo Đề xuất sửa chữa.
 */
import ExcelJS from 'exceljs';
import type { Db } from './db.js';

export interface ReportApi {
  db: Db;
}

const GREEN = '0E5A37';
const GREEN2 = '12794A';
const HEAD_TX = 'FFFFFF';
const LINE = 'D5DDD5';
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

/* ---------- Bao cao De xuat sua chua (thay the bao cao Tham kham) ---------- */
const DX_TT_LABEL: Record<string, string> = {
  'cho_duyet': 'Cho duyet', 'da_duyet': 'Da duyet', 'tu_choi': 'Tu choi', 'da_chuyen_sc': 'Da chuyen phieu sua chua'
};
const DX_UU_LABEL: Record<string, string> = { Khan_cap: 'Khan cap', Xu_ly_som: 'Xu ly som', Binh_thuong: 'Binh thuong' };

export async function buildDeXuatWorkbook(api: ReportApi) {
  const rows = await api.db.rows("SELECT * FROM de_xuat_sua_chua WHERE deleted_at='' ORDER BY ngay DESC, id DESC");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DE XUAT SUA CHUA', { views: [{ showGridLines: false }] });
  const W = 10;
  ws.columns = [
    { key: 'a', width: 14 }, { key: 'b', width: 13 }, { key: 'c', width: 15 }, { key: 'd', width: 18 },
    { key: 'e', width: 12 }, { key: 'f', width: 40 }, { key: 'g', width: 16 }, { key: 'h', width: 16 }, { key: 'i', width: 16 }, { key: 'j', width: 14 }
  ];
  letterhead(ws, W);
  titleRow(ws, W, 'BAO CAO DE XUAT SUA CHUA', 'Phong Xe may Thiet bi . Xuat luc ' + todayVN());
  headRow(ws, ['Ma de xuat', 'Ngay', 'Bien so', 'Nguoi tao', 'Uu tien', 'Mo ta', 'Trang thai', 'Nguoi duyet', 'Ngay duyet', 'Phieu SC']);
  rows.forEach((r) => {
    const row = ws.addRow([
      r.id, dmy(String(r.ngay)), r.bks, String(r.nguoi_tao || ""), DX_UU_LABEL[String(r.muc_uu_tien)] || String(r.muc_uu_tien) || "",
      String(r.mo_ta || ""), DX_TT_LABEL[String(r.trang_thai)] || String(r.trang_thai),
      String(r.nguoi_duyet || ""), dmy(String(r.ngay_duyet || "")), String(r.sc_id || "")
    ]);
    row.eachCell(borderCell);
  });
  if (rows.length) ws.autoFilter = { from: 'A1', to: 'J' + (rows.length + 1) };
  signatureBlock(ws, W);
  applyFont(ws);
  return (await wb.xlsx.writeBuffer());
}