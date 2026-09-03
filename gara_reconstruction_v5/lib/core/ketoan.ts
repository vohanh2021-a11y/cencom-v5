/**
 * ketoan.ts — Module Kế toán tập trung (GĐ2–GĐ4):
 *  - GĐ2: COGS (tinhGiaVon), đối chiếu (reconcileKho / reconcileInit).
 *  - GĐ3: VAT đầu vào (vatInvoiceSave), công nợ NCC (congNoList), phiếu chi (phieuChiCreate).
 *  - GĐ4: báo cáo (ledgerReport), khóa kỳ (kyClose), xuất HTML (buildReportHtml).
 * Mọi bút toán qua ledger.postInner / ledgerPost (có check quyền).
 *
 * Port NGUYÊN hành vi từ draft v4 `packages/core/src/ketoan.ts`
 * (branch draft/gd4-gd5-v4). Khác biệt kỹ thuật khi lên v5 (KHÔNG đổi behavior):
 *  - Surface `Db` của draft → adapter `LedgerDal`/`runInTransaction`
 *    (lib/core/ledger.ts). Toàn bộ SQL giữ nguyên từng ký tự.
 *  - reconcileKho #3: draft đọc bảng `lich_sua` (v3.6) — v5 KHÔNG còn bảng
 *    này, SC là `sc` (id = sc_id nghiệp vụ). Query đổi `FROM lich_sua l` →
 *    `FROM sc l` với `l.id AS sc_id`; cùng semantics "SC đã quyết toán mà 154
 *    chưa đóng" (xem ghi chú lib/core/asset.ts).
 *  - buildReportPdf/ledgerReportPdf: puppeteer CHƯA có trong dependencies v5
 *    (worker-c quyết định khi wire route in PDF) → dynamic import qua BIẾN để
 *    không vỡ typecheck/build; gọi thật khi chưa cài sẽ ném lỗi rõ ràng.
 *  - congNoList/ledgerList LIMIT: Math.floor chặn giá trị thập phân chèn vào
 *    SQL (hardening, không đổi kết quả với input hợp lệ).
 */
import type { Db, Actor, PermLike } from '../types';
import {
  postInner,
  getCogsMethod,
  asDal,
  runInTransaction,
  type LedgerPostArg,
  type LedgerEntry,
  type LedgerDal,
} from './ledger';

export type { LedgerPostArg, LedgerEntry };
export { getCogsMethod };

type AuthApi = { current(): { id: string; name: string; role: string } | null };
export interface KetoanApi {
  db: Db;
  auth: AuthApi;
  perm: PermLike;
}

function meId(api: KetoanApi): string {
  const u = api.auth.current();
  return u ? (u.id || u.name || '') : '';
}
async function checkLock(api: KetoanApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) {
    throw new Error('Không đủ quyền: cần ' + m + '.' + f);
  }
}

const r2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/* ===================== GĐ2 — COGS & Đối chiếu ===================== */

/** Tính giá vốn một lượng vật tư theo cogs_method (binh_quan | fifo). Không thay đổi tồn. */
export async function tinhGiaVon(db: Db | LedgerDal, vattuId: number | string, sl: number): Promise<number> {
  const dal: LedgerDal =
    typeof (db as LedgerDal).row === 'function' ? (db as LedgerDal) : asDal(db as Db);
  const method = await getCogsMethod(dal);
  if (method === 'fifo') {
    const lots = await dal.rows<{ id: string; con_lai: number; gia: number }>(
      "SELECT id, con_lai, gia FROM ton_lot WHERE vattu_id=$1 AND con_lai>0 AND deleted_at='' ORDER BY ngay ASC, id ASC",
      vattuId
    );
    let need = Number(sl) || 0;
    let tong = 0;
    for (const lot of lots) {
      if (need <= 0) break;
      const take = Math.min(need, Number(lot.con_lai));
      tong += take * Number(lot.gia);
      need -= take;
    }
    if (need > 0) {
      const vt = await dal.row<{ gia: number }>('SELECT gia FROM vattu WHERE id=$1 AND deleted_at=$2', vattuId, '');
      tong += need * (Number(vt?.gia) || 0);
    }
    return r2(tong);
  }
  // binh_quan (mặc định): dùng giá bình quân hiện tại
  const vt = await dal.row<{ gia: number }>('SELECT gia FROM vattu WHERE id=$1 AND deleted_at=$2', vattuId, '');
  return r2((Number(vt?.gia) || 0) * (Number(sl) || 0));
}

export interface ReconItem {
  check: string;
  expected: number;
  actual: number;
  diff: number;
  ok: boolean;
}

/** Khởi tạo số dư đầu kỳ (go-live): ghi opening để reconcile có baseline. Chỉ chạy 1 lần. */
export async function reconcileInit(api: KetoanApi): Promise<{ ok: boolean; opening_inventory: number; opening_payable: number }> {
  await checkLock(api, 'ke_toan', 'quyet');
  const db = asDal(api.db);
  const tonKho = Number((await db.row<{ v: number }>("SELECT COALESCE(SUM(ton*gia),0) v FROM vattu WHERE deleted_at=''"))?.v || 0);
  const l152 = Number((await db.row<{ n: number }>("SELECT COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) n FROM ledger WHERE tai_khoan='152' AND deleted_at=''"))?.n || 0);
  const l331 = Number((await db.row<{ n: number }>("SELECT COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) n FROM ledger WHERE tai_khoan='331' AND deleted_at=''"))?.n || 0);
  const openingInv = r2(tonKho - l152);
  const openingPay = r2(-l331);
  await db.configSet('opening_inventory', String(openingInv));
  await db.configSet('opening_payable', String(openingPay));
  return { ok: true, opening_inventory: openingInv, opening_payable: openingPay };
}

/** Đối chiếu Kế toán ↔ Kho / Công nợ. Trả cực kì lệch (nếu có). */
export async function reconcileKho(api: KetoanApi): Promise<{ ok: boolean; items: ReconItem[]; notes: string[] }> {
  await checkLock(api, 'ke_toan', 'xem');
  const db = asDal(api.db);
  const items: ReconItem[] = [];
  const notes: string[] = [];

  // 1) 152 ≡ tồn kho (tonKho − opening)
  const l152 = Number((await db.row<{ n: number }>("SELECT COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) n FROM ledger WHERE tai_khoan='152' AND deleted_at=''"))?.n || 0);
  const tonKho = Number((await db.row<{ v: number }>("SELECT COALESCE(SUM(ton*gia),0) v FROM vattu WHERE deleted_at=''"))?.v || 0);
  const openingInv = Number(await db.configGet('opening_inventory', '0')) || 0;
  const expInv = r2(tonKho - openingInv);
  const diffInv = r2(l152 - expInv);
  items.push({ check: '152 ≡ tồn kho', expected: expInv, actual: l152, diff: diffInv, ok: Math.abs(diffInv) < 0.01 });

  // 2) 331 (số dư Có) ≡ SUM(cong_no phai_tra)
  const l331 = Number((await db.row<{ n: number }>("SELECT COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) n FROM ledger WHERE tai_khoan='331' AND deleted_at=''"))?.n || 0);
  const congNo = Number((await db.row<{ s: number }>("SELECT COALESCE(SUM(con_no),0) s FROM cong_no WHERE loai='phai_tra' AND deleted_at=''"))?.s || 0);
  const openingPay = Number(await db.configGet('opening_payable', '0')) || 0;
  const expPay = r2(-l331 + openingPay);
  const diffPay = r2(congNo - expPay);
  items.push({ check: '331 ≡ công nợ phải trả', expected: expPay, actual: congNo, diff: diffPay, ok: Math.abs(diffPay) < 0.01 });

  // 3) 154: SC đã quyết toán mà 154 chưa đóng → lỗi
  //    (v5 không còn bảng lich_sua — SC là `sc`, id = sc_id; port semantics)
  const bad154 = await db.rows<{ sc_id: string }>(
    "SELECT l.id AS sc_id FROM sc l WHERE l.deleted_at='' AND (SELECT COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) FROM ledger WHERE tai_khoan='154' AND ref_id=l.id AND deleted_at='') <> 0"
  );
  if (bad154.length) notes.push('SC đã quyết toán nhưng 154 chưa đóng: ' + bad154.map((r) => r.sc_id).join(', '));

  // 4) 154: SC đang dở (chưa quyết toán) → chỉ liệt kê để theo dõi
  const open154 = await db.rows<{ sc_id: string }>(
    "SELECT ref_id sc_id FROM ledger WHERE tai_khoan='154' AND ref_id<>'' AND deleted_at='' GROUP BY ref_id HAVING COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) <> 0"
  );
  notes.push('SC đang dở dang (154 chưa đóng): ' + open154.length + ' phiếu');

  const okAll = items.every((i) => i.ok) && bad154.length === 0;
  return { ok: okAll, items, notes };
}

/* ===================== GĐ3 — VAT đầu vào ===================== */

/** Lưu Hóa Đơn đầu vào + hạch toán Nợ 133 / Có 331; liên kết công nợ NCC (tăng phải trả). */
export async function vatInvoiceSave(
  api: KetoanApi,
  arg: { ref_id?: string; ncc?: string; so_hd: string; ngay?: string; tien_hang?: number; tien_thue: number; ty_le?: number }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'ke_toan', 'vat');
  const so_hd = String(arg.so_hd || '').trim();
  const tien_thue = Math.max(0, Number(arg.tien_thue) || 0);
  if (!so_hd || tien_thue <= 0) return { ok: false, error: 'Thiếu số HĐ hoặc tiền thuế.' };
  const tien_hang = Math.max(0, Number(arg.tien_hang) || 0);
  return runInTransaction(api.db, async (tx) => {
    const vatId = await tx.nextId('VAT');
    const ngay = arg.ngay || tx.today();
    await tx.run(
      'INSERT INTO vat_invoice(id, ncc, so_hd, ngay, tien_hang, tien_thue, ty_le, ref_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      vatId, arg.ncc || '', so_hd, ngay, tien_hang, tien_thue, Number(arg.ty_le) || 0, arg.ref_id || ''
    );
    const post = await postInner(
      tx,
      { so_ct: so_hd, ngay, loai_ct: 'vat_in', nguoi: meId(api), ref_type: 'vat_invoice', ref_id: vatId, entries: [{ tai_khoan: '133', du_no: tien_thue }, { tai_khoan: '331', du_co: tien_thue }] },
      meId(api)
    );
    if (!post.ok) throw new Error(post.error || 'Lỗi ghi sổ VAT.');
    if (arg.ref_id) {
      const cn = await tx.row<{ id: string; con_no: number }>("SELECT id, con_no FROM cong_no WHERE ref_id=$1 AND loai='phai_tra' AND deleted_at=''", arg.ref_id);
      if (cn) {
        await tx.run('UPDATE cong_no SET so_tien=so_tien+$1, con_no=con_no+$1 WHERE id=$2', tien_thue, cn.id);
      } else {
        const cnId = await tx.nextId('CN');
        await tx.run(
          "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES($1,'phai_tra',$2,$3,'vat_invoice',$4,$5,$6,0,$6)",
          cnId, arg.ncc || '', so_hd, vatId, ngay, tien_thue
        );
      }
    }
    return { ok: true, id: vatId };
  });
}

/* ===================== GĐ3 — Công nợ NCC & Phiếu chi ===================== */

/** Thanh toán công nợ NCC: giảm cong_no, post Nợ 331 / Có 112. Chặn vượt số nợ. */
export async function phieuChiCreate(
  api: KetoanApi,
  arg: { cong_no_id: string; so_tien: number; ngay?: string; hinh_thuc?: string; nguoi_nhan?: string; note?: string; cp_ve_phuphi?: number }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'ke_toan', 'chi');
  const cnId = String(arg.cong_no_id || '').trim();
  const so_tien = r2(Number(arg.so_tien) || 0);
  if (!cnId) return { ok: false, error: 'Thiếu mã công nợ.' };
  if (so_tien <= 0) return { ok: false, error: 'Số tiền phải > 0.' };
  return runInTransaction(api.db, async (tx) => {
    const cn = await tx.row<{ id: string; con_no: number; da_dong: boolean; ref_type: string; ref_id: string }>(
      "SELECT id, con_no, da_dong, ref_type, ref_id FROM cong_no WHERE id=$1 AND loai='phai_tra' AND deleted_at=''",
      cnId
    );
    if (!cn) return { ok: false, error: 'Không tìm thấy công nợ.' };
    if (cn.da_dong) return { ok: false, error: 'Công nợ đã đóng (đã thanh toán xong).' };
    // P2.2a (Nguyên tắc 2 - QC206 Điều 2): KHÔNG thanh toán công nợ mua hàng khi chưa có HÓA ĐƠN đầu vào.
    // Chỉ chặn ref_type='phieu_nhap'; công nợ nội bộ (ghi_no, tạm ứng...) không bị ảnh hưởng.
    if (cn.ref_type === 'phieu_nhap' && cn.ref_id) {
      const inv = await tx.row<{ id: string }>(
        "SELECT id FROM vat_invoice WHERE ref_id=$1 AND deleted_at=''",
        cn.ref_id
      );
      if (!inv) return { ok: false, error: 'Vi phạm QC206 Điều 2: công nợ mua hàng chưa có HÓA ĐƠN đầu vào, không được thanh toán.' };
    }
    if (so_tien > Number(cn.con_no) + 0.005) return { ok: false, error: 'Số tiền chi vượt quá số nợ còn lại (' + cn.con_no + ').' };
    const pcId = await tx.nextId('PC');
    const ngay = arg.ngay || tx.today();
    await tx.run(
      'INSERT INTO phieu_chi(id, ngay, nguoi, cong_no_id, so_tien, hinh_thuc, nguoi_nhan, note, cp_ve_phuphi) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      pcId, ngay, meId(api), cnId, so_tien, arg.hinh_thuc || 'ck', arg.nguoi_nhan || '', arg.note || '', Number(arg.cp_ve_phuphi) || 0
    );
    const newConNo = r2(Number(cn.con_no) - so_tien);
    await tx.run(
      'UPDATE cong_no SET da_tt=da_tt+$1, con_no=($2::numeric), da_dong=CASE WHEN ($2::numeric)<=0 THEN true ELSE false END WHERE id=$3',
      so_tien, newConNo, cnId
    );
    const post = await postInner(
      tx,
      { so_ct: pcId, ngay, loai_ct: 'phieu_chi', nguoi: meId(api), ref_type: 'phieu_chi', ref_id: pcId, entries: [{ tai_khoan: '331', du_no: so_tien }, { tai_khoan: '112', du_co: so_tien }] },
      meId(api)
    );
    if (!post.ok) throw new Error(post.error || 'Lỗi ghi sổ phiếu chi.');
    return { ok: true, id: pcId };
  });
}

function daysBetween(a: string, b: string): number {
  const d = (Date.parse(b) - Date.parse(a)) / 86400000;
  return Math.floor(Number.isFinite(d) ? d : 0);
}

/** Danh sách công nợ (mặc định phai_tra) + tuổi nợ. */
export async function congNoList(
  api: KetoanApi,
  q: { loai?: string; qua_han?: boolean; q?: string; limit?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  await checkLock(api, 'ke_toan', 'xem');
  const db = asDal(api.db);
  const a: unknown[] = [''];
  let sql = "SELECT * FROM cong_no WHERE deleted_at=$1";
  const loai = q.loai || 'phai_tra';
  sql += ' AND loai=$' + (a.length + 1);
  a.push(loai);
  if (q.qua_han) {
    sql += " AND con_no>0 AND han_tt<>'' AND han_tt < $" + (a.length + 1);
    a.push(db.today());
  }
  if (q.q) {
    sql += ' AND upper(doi_tac) LIKE $' + (a.length + 1);
    a.push('%' + String(q.q).toUpperCase() + '%');
  }
  // Math.floor: chặn giá trị thập phân chèn vào LIMIT (hardening)
  sql += ' ORDER BY han_tt ASC, ngay DESC LIMIT ' + Math.floor(Math.min(Number(q.limit) || 500, 5000));
  const rows = await db.rows<Record<string, unknown>>(sql, ...a);
  const today = db.today();
  return rows.map((r) => {
    const han = String(r.han_tt || '');
    const tuoi = han && han < today ? daysBetween(han, today) : 0;
    return { ...r, tuoi_no: tuoi };
  });
}

/**
 * P2.2a — Báo cáo công nợ mua hàng (loai='phai_tra', ref_type='phieu_nhap')
 * còn dư nhưng CHƯA có HÓA ĐƠN đầu vào. Phục vụ kiểm soát "không thanh toán khi thiếu HĐ".
 * Chỉ trả các dòng chưa đóng (con_no>0) và không tồn tại vat_invoice ứng với ref_id.
 */
export async function congNoChuaCoHoaDon(
  api: KetoanApi
): Promise<Array<Record<string, unknown>>> {
  await checkLock(api, 'ke_toan', 'xem');
  const db = asDal(api.db);
  const rows = await db.rows<Record<string, unknown>>(
    `SELECT cn.* FROM cong_no cn
     WHERE cn.deleted_at='' AND cn.loai='phai_tra' AND cn.ref_type='phieu_nhap' AND cn.ref_id<>''
       AND cn.con_no>0
       AND NOT EXISTS (SELECT 1 FROM vat_invoice v WHERE v.ref_id=cn.ref_id AND v.deleted_at='')
     ORDER BY cn.ngay ASC`
  );
  return rows;
}

/* ===================== GĐ4 — Báo cáo & Khóa kỳ ===================== */

export interface ReportResult {
  ky: { tu_ngay: string; den_ngay: string };
  cdkt: Array<{ ma_so: string; ten: string; loai: string; du_no: number; du_co: number; so_du: number }>;
  tong_tai_san: number;
  tong_nguon: number;
  chi_phi: Array<{ ma_so: string; ten: string; du_no: number }>;
  so_152: Array<Record<string, unknown>>;
  so_331: Array<Record<string, unknown>>;
  so_133: Array<Record<string, unknown>>;
  so_quy: { thu: number; chi: number; rows: Array<{ ngay: string; loai_quy: string; doi_tac: string; so_tien: number; ly_do: string }> };
}

/** Báo cáo kế toán: CĐKT, KQHĐKD chi phí, sổ 152/331/133. */
export async function ledgerReport(
  api: KetoanApi,
  q: { tu_ngay?: string; den_ngay?: string } = {}
): Promise<ReportResult> {
  await checkLock(api, 'ke_toan', 'baocao');
  const db = asDal(api.db);
  const tu = q.tu_ngay || '0000-01-01';
  const den = q.den_ngay || '9999-12-31';
  const rows = await db.rows<{ ma_so: string; ten: string; loai: string; no: number; co: number }>(
    `SELECT tk.ma_so, tk.ten, tk.loai, COALESCE(SUM(l.du_no),0) no, COALESCE(SUM(l.du_co),0) co
     FROM ledger l JOIN tai_khoan tk ON tk.ma_so=l.tai_khoan AND tk.deleted_at=''
     WHERE l.deleted_at='' AND l.ngay BETWEEN $1 AND $2
     GROUP BY tk.ma_so, tk.ten, tk.loai ORDER BY tk.ma_so`,
    tu, den
  );
  let tongTS = 0;
  let tongNV = 0;
  const cdkt = rows.map((r) => {
    const no = Number(r.no) || 0;
    const co = Number(r.co) || 0;
    const so_du = r.loai === 'tai_san' || r.loai === 'chi_phi' ? no - co : co - no;
    if (r.loai === 'tai_san' || r.loai === 'chi_phi') tongTS += so_du;
    else tongNV += so_du;
    return { ma_so: r.ma_so, ten: r.ten, loai: r.loai, du_no: r2(no), du_co: r2(co), so_du: r2(so_du) };
  });
  const cpRows = await db.rows<{ ma_so: string; ten: string; no: number }>(
    `SELECT tk.ma_so, tk.ten, COALESCE(SUM(l.du_no),0) no FROM ledger l JOIN tai_khoan tk ON tk.ma_so=l.tai_khoan AND tk.deleted_at=''
     WHERE l.deleted_at='' AND l.ngay BETWEEN $1 AND $2 AND tk.ma_so IN ('621','622','627','641','642') GROUP BY tk.ma_so, tk.ten ORDER BY tk.ma_so`,
    tu, den
  );
  const chi_phi = cpRows.map((r) => ({ ma_so: r.ma_so, ten: r.ten, du_no: r2(Number(r.no) || 0) }));
  const so_152 = await db.rows<Record<string, unknown>>("SELECT ngay, ref_type, ref_id, du_no, du_co FROM ledger WHERE tai_khoan='152' AND deleted_at='' AND ngay BETWEEN $1 AND $2 ORDER BY ngay", tu, den);
  const so_331 = await db.rows<Record<string, unknown>>("SELECT ngay, ref_type, ref_id, du_no, du_co FROM ledger WHERE tai_khoan='331' AND deleted_at='' AND ngay BETWEEN $1 AND $2 ORDER BY ngay", tu, den);
  const so_133 = await db.rows<Record<string, unknown>>("SELECT ngay, ref_type, ref_id, du_no, du_co FROM ledger WHERE tai_khoan='133' AND deleted_at='' AND ngay BETWEEN $1 AND $2 ORDER BY ngay", tu, den);
  const sq = await db.rows<{ ngay: string; loai_quy: string; doi_tac: string; so_tien: number; ly_do: string; loai_ps: string }>(
    "SELECT ngay, loai_quy, doi_tac, so_tien, ly_do, loai_ps FROM so_quy WHERE deleted_at='' AND ngay BETWEEN $1 AND $2 ORDER BY ngay DESC, id DESC",
    tu, den
  );
  let thu = 0;
  let chi = 0;
  for (const r of sq) {
    if (r.loai_ps === 'thu') thu += Number(r.so_tien) || 0;
    else chi += Number(r.so_tien) || 0;
  }
  const so_quy = {
    thu: r2(thu),
    chi: r2(chi),
    rows: sq.map((r) => ({ ngay: r.ngay || '', loai_quy: r.loai_quy || '', doi_tac: r.doi_tac || '', so_tien: r2(r.so_tien), ly_do: r.ly_do || '' })),
  };
  return { ky: { tu_ngay: tu, den_ngay: den }, cdkt, tong_tai_san: r2(tongTS), tong_nguon: r2(tongNV), chi_phi, so_152, so_331, so_133, so_quy };
}

/** Khóa kỳ kế toán: đánh dấu da_dong → postInner tự chối ghi chứng từ trong kỳ. */
export async function kyClose(
  api: KetoanApi,
  arg: { ten_ky: string; tu_ngay: string; den_ngay: string }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'ke_toan', 'ky');
  const db = asDal(api.db);
  if (!arg.ten_ky || !/^\d{4}-\d{2}-\d{2}$/.test(arg.tu_ngay || '') || !/^\d{4}-\d{2}-\d{2}$/.test(arg.den_ngay || ''))
    return { ok: false, error: 'Thiếu tên kỳ hoặc ngày sai định dạng YYYY-MM-DD.' };
  const id = await db.nextId('KY');
  await db.run(
    'INSERT INTO ky_ke_toan(id, ten_ky, tu_ngay, den_ngay, da_dong) VALUES($1,$2,$3,$4,true)',
    id, arg.ten_ky, arg.tu_ngay, arg.den_ngay
  );
  await db.audit('ke_toan', 'ky_ke_toan', id, meId(api), 'Khóa kỳ ' + arg.ten_ky);
  return { ok: true, id };
}

/** Mở lại kỳ đã đóng (chỉ quyền ke_toan.ky) — cho phép ghi bổ sung chứng từ. */
export async function kyOpen(
  api: KetoanApi,
  arg: { id?: string; ten_ky?: string } = {}
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'ke_toan', 'ky');
  const db = asDal(api.db);
  const id = String(arg.id || '').trim();
  const ten = String(arg.ten_ky || '').trim();
  if (!id && !ten) return { ok: false, error: 'Thiếu id hoặc ten_ky.' };
  const r = await db.row<{ id: string }>(
    "SELECT id FROM ky_ke_toan WHERE deleted_at='' AND " + (id ? 'id=$1' : 'ten_ky=$1'),
    id || ten
  );
  if (!r) return { ok: false, error: 'Không tìm thấy kỳ.' };
  await db.run('UPDATE ky_ke_toan SET da_dong=false WHERE id=$1', r.id);
  await db.audit('ke_toan', 'ky_ke_toan', r.id, meId(api), 'Mở lại kỳ');
  return { ok: true, id: r.id };
}

/** Escape HTML để tránh XSS khi render báo cáo (tên tài khoản/đối tượng có thể chứa ký tự đặc biệt). */
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

/** Xuất báo cáo HTML (in A4) — thay thế .docx theo quy định AGENTS. Dữ liệu đã escape (XSS-safe). */
export function buildReportHtml(rep: ReportResult): string {
  const row = (c: Array<unknown>) => '<tr>' + c.map((x) => '<td>' + esc(x) + '</td>').join('') + '</tr>';
  const head = (c: Array<unknown>) => '<tr>' + c.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr>';
  const cdkt = rep.cdkt.map((r) => row([r.ma_so, r.ten, r.loai, r.du_no.toFixed(2), r.du_co.toFixed(2), r.so_du.toFixed(2)])).join('');
  const cp = rep.chi_phi.map((r) => row([r.ma_so, r.ten, r.du_no.toFixed(2)])).join('');
  return (
    '<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>' +
    '@page{size:A4;margin:12mm}body{font-family:Arial;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}.r{text-align:right}.c{text-align:center}h2{text-align:center}@media print{.noprint{display:none}}' +
    '</style></head><body>' +
    '<h2>BÁO CÁO KẾ TOÁN</h2>' +
    '<p>Kỳ: ' + esc(rep.ky.tu_ngay) + ' → ' + esc(rep.ky.den_ngay) + '</p>' +
    '<h3>I. Cân đối kế toán</h3><table>' + head(['Mã', 'Tên', 'Loại', 'Nợ', 'Có', 'Số dư']) + cdkt + '</table>' +
    '<p>Tổng tài sản: <b>' + rep.tong_tai_san.toFixed(2) + '</b> | Tổng nguồn vốn: <b>' + rep.tong_nguon.toFixed(2) + '</b></p>' +
    '<h3>II. Chi phí (KQHĐKD)</h3><table>' + head(['Mã', 'Tên', 'Nợ']) + cp + '</table>' +
    '<p class="noprint"><button onclick="window.print()">In / Xuất PDF</button></p>' +
    '</body></html>'
  );
}

/** Tạo PDF tự báo cáo (server-side, dùng puppeteer). Chỉ chạy trong Node.js runtime. */
export async function buildReportPdf(rep: ReportResult): Promise<Buffer> {
  if (typeof window !== 'undefined') {
    throw new Error('buildReportPdf chỉ chạy ở server-side (Node.js runtime).');
  }
  // Import động QUA BIẾN: puppeteer chưa nằm trong dependencies v5 (worker-c
  // quyết định khi wire route in PDF) — biến chỉ định ở runtime, giữ typecheck
  // của bundle edge/server không vỡ; thiếu module → lỗi rõ ràng khi gọi thật.
  const modName = 'puppeteer';
  let puppeteer: { default: { launch(o: Record<string, unknown>): Promise<any> } };
  try {
    puppeteer = (await import(/* webpackIgnore: true */ modName)) as typeof puppeteer;
  } catch (e: unknown) {
    throw new Error(
      'puppeteer chưa được cài cho module kế toán v5 (' +
        ((e as { message?: string })?.message || e) +
        ') — dùng buildReportHtml + in A4 qua /in/* theo quy định AGENTS.'
    );
  }
  const html = buildReportHtml(rep);
  const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** RPC wrapper cho ledgerReportPdf — dùng cho export API route (binary response). */
export async function ledgerReportPdf(api: KetoanApi, q: { tu_ngay?: string; den_ngay?: string } = {}): Promise<Buffer> {
  const rep = await ledgerReport(api, q);
  return buildReportPdf(rep);
}
