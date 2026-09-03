/**
 * ketoan.test.ts — PORT conformance module Kế toán VAS (ledger + ketoan) từ draft v4
 * (packages/core/tests/{ledger,ketoan-gd2,ketoan-gd3,ketoan-integ,ledger-gd4}.test.ts)
 * sang v5: jest + PostgreSQL thật (không còn vitest + PGlite/makeCtx).
 *
 * Thích ứng khi port (hành vi core GIỮ NGUYÊN, chỉ thay scaffold test):
 *  - Schema kế toán KHÔNG nằm trong db/migrate.ts (chỉ schema.sql) → beforeAll
 *    tự áp `db/accounting.sql` (idempotent) + seed CoA inline (nội dung
 *    coa_seed.sql của draft) — đúng tinh thần fixture cô lập per-suite của
 *    scripts/test-conformance.mjs (mỗi file 1 DB reset mới).
 *  - Role: `perm.MATRIX` v5 CHƯA cấp module `ke_toan` (chờ worker-c wire RPC —
 *    quên khai báo là lỗ hổng, xem AGENTS). Admin bypass trong can() → happy
 *    path chạy với actor admin 'U-ADMIN' (seed sẵn, thỏa FK activity_log.actor_id).
 *    Case "thiếu quyền" giữ nguyên bằng role lạ 'tho' (draft dùng tho).
 *  - GĐ2 COGS draft tính bình quân qua kho.phNhapCreate — v5 chưa wire hook
 *    ledger vào kho ⇒ tinhGiaVon test bằng fixture SQL trực tiếp (binh_quan:
 *    vattu.gia; fifo: ton_lot) + thêm ca fifo/tràn lot (draft chưa phủ).
 *  - ketoan-integ (hooks kho/sc/asset→ledger) CHƯA port được vì các core đó
 *    chưa nối postInner ở v5 — thay bằng ca "154 dở dang" qua sổ tay, tương
 *    đương phần assert của reconcile notes.
 *  - ledger-gd4 B6 sổ quỹ: draft chạy ctx mới per test (vitest) → gộp suite
 *    dùng cửa ngày RIÊNG 2027-02 để assert tuyệt đối không đụng các ca trước.
 *  - Khóa kỳ GĐ4 đặt CUỐI file (draft tách file nên không đụng ngày 2026-08).
 */
import { join } from 'path';
import { readFileSync } from 'fs';
import { buildApi } from '../../lib/api';
import { db } from '../../lib/db';
import * as ledger from '../../lib/core/ledger';
import { asDal } from '../../lib/core/ledger';
import * as ketoan from '../../lib/core/ketoan';

/** Draft-compat surface trên pool v5 (row/rows/run variadic) */
const dal = asDal(db);

const ACCOUNTING_SQL = join(__dirname, '..', '..', 'db', 'accounting.sql');

// Nội dung coa_seed.sql (draft) — idempotent ON CONFLICT DO NOTHING
const COA_SEED = `
INSERT INTO tai_khoan(id, tenant_id, ma_so, ten, loai, cap) VALUES
  ('TK-000001','c1','111','Tiền mặt','tai_san',1),
  ('TK-000002','c1','112','Tiền gửi ngân hàng','tai_san',1),
  ('TK-000003','c1','152','Nguyên liệu, vật liệu (phụ tùng)','tai_san',1),
  ('TK-000004','c1','153','Công cụ dụng cụ','tai_san',1),
  ('TK-000005','c1','154','Chi phí SXKD dở dang (sửa chữa)','tai_san',1),
  ('TK-000006','c1','156','Hàng hóa','tai_san',1),
  ('TK-000007','c1','211','TSCĐ hữu hình (xe đầu kéo)','tai_san',1),
  ('TK-000008','c1','214','Hao mòn TSCĐ','tai_san',1),
  ('TK-000009','c1','241','XDCB dở dang (nâng cấp lớn)','tai_san',1),
  ('TK-000010','c1','331','Phải trả người bán (NCC)','no_phai_tra',1),
  ('TK-000011','c1','3331','Thuế GTGT phải nộp','no_phai_tra',1),
  ('TK-000012','c1','334','Phải trả người lao động','no_phai_tra',1),
  ('TK-000013','c1','421','Lợi nhuận chưa phân phối','von_chu_so_huu',1),
  ('TK-000014','c1','621','Chi phí NVL trực tiếp','chi_phi',1),
  ('TK-000015','c1','622','Chi phí nhân công trực tiếp','chi_phi',1),
  ('TK-000016','c1','627','Chi phí sản xuất chung','chi_phi',1),
  ('TK-000017','c1','641','Chi phí bán hàng','chi_phi',1),
  ('TK-000018','c1','642','Chi phí quản lý doanh nghiệp','chi_phi',1),
  ('TK-000019','c1','911','Xác định kết quả kinh doanh','chi_phi',1),
  ('TK-000020','c1','632','Giá vốn hàng bán','chi_phi',1),
  ('TK-000021','c1','133','Thuế GTGT được khấu trừ (VAT đầu vào)','tai_san',1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ke_toan_setting(id, tenant_id, key, value) VALUES
  ('KS-000001','c1','cogs_method','binh_quan')
ON CONFLICT (tenant_id, key) DO NOTHING;
`;

const apiAdmin = buildApi({ id: 'U-ADMIN', name: 'KeToanTest', role: 'admin' });
const apiTho = buildApi({ id: 'U-THO1', name: 'Tho Test', role: 'tho' });

async function ledgerNet(tk: string): Promise<number> {
  const r = await dal.row<{ n: number }>(
    "SELECT COALESCE(SUM(du_no),0)-COALESCE(SUM(du_co),0) n FROM ledger WHERE tai_khoan=$1 AND deleted_at=''",
    tk
  );
  return Number(r?.n) || 0;
}

function mkVattu(id: string, gia: number, ton: number): Promise<void> {
  return dal.run(
    'INSERT INTO vattu(id, ten, don_vi, ton, gia, ton_min, is_test, deleted_at) VALUES($1,$2,$3,$4,$5,0,1,$6)',
    id, 'KT fixture ' + id, 'cái', ton, gia, ''
  );
}

const createdVattu = ['KT-VT-COGS01', 'KT-VT-FIFO01', 'KT-VT-RECON1'];

beforeAll(async () => {
  await db.query(readFileSync(ACCOUNTING_SQL, 'utf8')); // multi-stmt (same path as migrate.ts)
  await db.query(COA_SEED);
}, 60000);

afterAll(async () => {
  // soft-delete fixture vật tư theo chuẩn v5 (không DELETE cứng); lot ẩn theo vattu
  await dal.run("UPDATE vattu SET deleted_at = '2026-09-03' WHERE id = ANY($1::text[])", createdVattu);
  await dal.run(
    "UPDATE ton_lot SET deleted_at = '2026-09-03' WHERE vattu_id = ANY($1::text[])",
    createdVattu
  );
});

jest.setTimeout(60000);

/* ============================================================ */
describe('ledger sổ cái kép — GĐ1 (port ledger.test.ts)', () => {
  // GĐ1 dùng cặp TK biên (111/421) — tránh lệch baseline reconcileInit của draft
  // (công thức opening của draft giả định ledger 152/331 sạch lúc go-live).
  const VALID: ledger.LedgerPostArg = {
    so_ct: 'KT-CT-T1',
    ngay: '2026-08-20',
    loai_ct: 'phieu_nhap',
    entries: [
      { tai_khoan: '111', du_no: 100 },
      { tai_khoan: '421', du_co: 100 },
    ],
  };

  test('ledgerPost ghi chứng từ cân bằng (Nợ 111 / Có 421)', async () => {
    const r = await ledger.ledgerPost(apiAdmin, { ...VALID, so_ct: 'KT-CT-000001' });
    expect(r.ok).toBe(true);
    expect(r.ct_id).toBeTruthy();
    const rows = await dal.rows<Record<string, unknown>>(
      'SELECT * FROM ledger WHERE ct_id=$1 AND deleted_at=$2',
      r.ct_id, ''
    );
    expect(rows.length).toBe(2);
    const so = rows.reduce((s, x) => s + Number(x.du_no || 0), 0);
    const co = rows.reduce((s, x) => s + Number(x.du_co || 0), 0);
    expect(Math.abs(so - co)).toBeLessThan(0.005);
  });

  test('ledgerPost TỪ CHỐI khi tổng Nợ != tổng Có (không ghi row)', async () => {
    const r = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'KT-CT-000002',
      ngay: '2026-08-20',
      loai_ct: 'phieu_nhap',
      entries: [
        { tai_khoan: '152', du_no: 100 },
        { tai_khoan: '331', du_co: 90 },
      ],
    });
    expect(r.ok).toBe(false);
    const ct = await dal.row<{ id: string }>('SELECT id FROM chung_tu WHERE so_ct=$1', 'KT-CT-000002');
    expect(ct).toBeUndefined();
  });

  test('ledgerPost TỪ CHỐI khi tài khoản không tồn tại', async () => {
    const r = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'KT-CT-000003',
      ngay: '2026-08-20',
      loai_ct: 'phieu_nhap',
      entries: [
        { tai_khoan: '999', du_no: 100 },
        { tai_khoan: '331', du_co: 100 },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/không tồn tại/);
  });

  test('ledgerPost TỪ CHỐI khi thiếu quyền (role tho)', async () => {
    const r = await ledger.ledgerPost(apiTho, { ...VALID, so_ct: 'KT-CT-000004' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Không đủ quyền/);
  });

  test('ledgerList trả bút toán đã ghi, lọc theo tài khoản', async () => {
    const list = await ledger.ledgerList(apiAdmin, { tai_khoan: '111' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  test('getCogsMethod mặc định binh_quan', async () => {
    expect(await ledger.getCogsMethod(apiAdmin.db)).toBe('binh_quan');
  });
});

/* ============================================================ */
describe('ketoan GĐ2 — COGS (port ketoan-gd2, fixture SQL thay hook kho)', () => {
  test('binh_quan: tinhGiaVon = gia hiện tại × sl', async () => {
    await mkVattu('KT-VT-COGS01', 1500, 0);
    const gv = await ketoan.tinhGiaVon(apiAdmin.db, 'KT-VT-COGS01', 5);
    expect(gv).toBeCloseTo(7500, 5);
  });

  test('fifo: tiêu thụ lot theo ngay ASC, tràn lot lấy gia vattu', async () => {
    await mkVattu('KT-VT-FIFO01', 9999, 0); // gia ngoài lot = đường biên fallback
    await dal.run(
      "INSERT INTO ton_lot(id, vattu_id, so_luong, gia, con_lai, ngay, deleted_at) VALUES('KT-LOT-FIFO1','KT-VT-FIFO01',10,1000,10,'2026-09-01',''),('KT-LOT-FIFO2','KT-VT-FIFO01',10,2000,10,'2026-09-02','')"
    );
    await dal.run(
      "INSERT INTO ke_toan_setting(id, tenant_id, key, value) VALUES('KS-000001','c1','cogs_method','fifo') ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value"
    );
    try {
      expect(await ketoan.tinhGiaVon(apiAdmin.db, 'KT-VT-FIFO01', 12)).toBeCloseTo(14000, 5); // 10*1000+2*2000
      expect(await ketoan.tinhGiaVon(apiAdmin.db, 'KT-VT-FIFO01', 25)).toBeCloseTo(10000 + 20000 + 5 * 9999, 5); // tràn lot: 25−20=5 đơn vị @ gia vattu
    } finally {
      await dal.run("UPDATE ke_toan_setting SET value='binh_quan' WHERE id='KS-000001'");
    }
  });
});

describe('ketoan GĐ2 — reconcileInit/reconcileKho (152 ≡ tồn kho, 331 ≡ công nợ)', () => {
  let inv0 = 0;
  let pay0 = 0;

  test('reconcileInit lưu baseline vào config', async () => {
    await mkVattu('KT-VT-RECON1', 1000, 0);
    const r = await ketoan.reconcileInit(apiAdmin);
    expect(r.ok).toBe(true);
    inv0 = r.opening_inventory;
    pay0 = r.opening_payable;
    const c1 = await dal.row<{ value: string }>('SELECT value FROM config WHERE key=$1', 'opening_inventory');
    const c2 = await dal.row<{ value: string }>('SELECT value FROM config WHERE key=$1', 'opening_payable');
    expect(Number(c1?.value)).toBeCloseTo(inv0, 2);
    expect(Number(c2?.value)).toBeCloseTo(pay0, 2);
  });

  test('đối xứng nhập kho 6000 (sổ + tồn + công nợ) → reconcile khớp', async () => {
    const post = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'KT-REC-CT1',
      ngay: '2026-09-20',
      loai_ct: 'phieu_nhap',
      ref_type: 'phieu_nhap',
      ref_id: 'KT-REC-PN1',
      entries: [
        { tai_khoan: '152', du_no: 6000 },
        { tai_khoan: '331', du_co: 6000 },
      ],
    });
    expect(post.ok).toBe(true);
    await dal.run("UPDATE vattu SET ton = ton + 6 WHERE id='KT-VT-RECON1'"); // Δgiá trị = 6×1000
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('KT-CN-REC01','phai_tra','NCC Test','KT','phieu_nhap','KT-REC-PN1','2026-09-20',6000,0,6000)"
    );
    const rec = await ketoan.reconcileKho(apiAdmin);
    const inv = rec.items.find((i) => i.check.startsWith('152'));
    const pay = rec.items.find((i) => i.check.startsWith('331'));
    expect(inv).toBeTruthy();
    expect(inv!.ok).toBe(true);
    expect(inv!.diff).toBeCloseTo(0, 5);
    expect(pay!.ok).toBe(true);
    expect(pay!.diff).toBeCloseTo(0, 5);
    expect(rec.ok).toBe(true);
  });

  test('chi phí xuất vào 154 chưa quyết toán → lệch 152 + note dở dang', async () => {
    const post = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'KT-REC-CT2',
      ngay: '2026-09-21',
      loai_ct: 'phieu_xuat',
      ref_type: 'sc',
      ref_id: 'KT-SC-0001',
      entries: [
        { tai_khoan: '154', du_no: 100 },
        { tai_khoan: '152', du_co: 100 },
      ],
    });
    expect(post.ok).toBe(true);
    const rec = await ketoan.reconcileKho(apiAdmin);
    const inv = rec.items.find((i) => i.check.startsWith('152'));
    expect(inv!.ok).toBe(false);
    expect(inv!.diff).toBeCloseTo(-100, 5);
    expect(rec.notes.some((n) => n.includes('154 chưa đóng'))).toBe(true);
    expect(rec.ok).toBe(false);
  });
});

/* ============================================================ */
describe('ketoan GĐ3 — VAT đầu vào (port ketoan-gd3)', () => {
  test('vatInvoiceSave ghi Nợ 133 / Có 331 = tiền thuế', async () => {
    const n133b = await ledgerNet('133');
    const n331b = await ledgerNet('331');
    const res = await ketoan.vatInvoiceSave(apiAdmin, { so_hd: 'HD-GD3-1', tien_thue: 100, tien_hang: 1000, ngay: '2026-09-01' });
    expect(res.ok).toBe(true);
    expect(await ledgerNet('133')).toBeCloseTo(n133b + 100, 2);
    expect(await ledgerNet('331')).toBeCloseTo(n331b - 100, 2);
    const vat = await dal.row<{ id: string }>("SELECT id FROM vat_invoice WHERE so_hd='HD-GD3-1' AND deleted_at=''");
    expect(vat).toBeTruthy();
  });

  test('vatInvoiceSave thiếu số HĐ hoặc thuế ≤ 0 → từ chối hợp lệ', async () => {
    const r1 = await ketoan.vatInvoiceSave(apiAdmin, { so_hd: '', tien_thue: 100 });
    expect(r1.ok).toBe(false);
    expect(r1.error).toMatch(/Thiếu số HĐ/);
    const r2 = await ketoan.vatInvoiceSave(apiAdmin, { so_hd: 'HD-GD3-Z', tien_thue: 0 });
    expect(r2.ok).toBe(false);
  });

  test('vatInvoiceSave ref_id nối công nợ phieu_nhap → tăng phải trả đúng thuế', async () => {
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('KT-CN-LINK1','phai_tra','NCC Link','KT','phieu_nhap','KT-PN-LINK','2026-09-03',1000,0,1000)"
    );
    const res = await ketoan.vatInvoiceSave(apiAdmin, { ref_id: 'KT-PN-LINK', ncc: 'NCC Link', so_hd: 'HD-GD3-LINK', tien_thue: 100, tien_hang: 1000 });
    expect(res.ok).toBe(true);
    const cn = await dal.row<{ so_tien: number; con_no: number }>("SELECT so_tien, con_no FROM cong_no WHERE id='KT-CN-LINK1'");
    expect(Number(cn?.so_tien)).toBeCloseTo(1100, 2);
    expect(Number(cn?.con_no)).toBeCloseTo(1100, 2);
  });
});

describe('ketoan GĐ3 — Công nợ & Phiếu chi + QC206 Điều 2', () => {
  test('phieuChiCreate giảm công nợ, ghi Nợ 331 / Có 112', async () => {
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('CN-GD3-1','phai_tra','NCC A','CN','x','x','2026-09-02',1000,0,1000)"
    );
    const n331b = await ledgerNet('331');
    const n112b = await ledgerNet('112');
    const res = await ketoan.phieuChiCreate(apiAdmin, { cong_no_id: 'CN-GD3-1', so_tien: 600, ngay: '2026-09-02' });
    expect(res.ok).toBe(true);
    expect(await ledgerNet('331')).toBeCloseTo(n331b + 600, 2); // Nợ 331 (giảm nợ phải trả)
    expect(await ledgerNet('112')).toBeCloseTo(n112b - 600, 2); // Có 112 (tiền mặt/ngân hàng giảm)
    const cn = await dal.row<{ con_no: number; da_dong: boolean }>("SELECT con_no, da_dong FROM cong_no WHERE id='CN-GD3-1'");
    expect(Number(cn?.con_no)).toBeCloseTo(400, 2);
    expect(cn?.da_dong).toBe(false);
  });

  test('phieuChiCreate chặn số tiền vượt công nợ', async () => {
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('CN-GD3-2','phai_tra','NCC B','CN','x','x','2026-09-02',300,0,300)"
    );
    const res = await ketoan.phieuChiCreate(apiAdmin, { cong_no_id: 'CN-GD3-2', so_tien: 500 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/vượt/i);
  });

  test('congNoList trả danh sách công nợ còn dư + tuổi nợ', async () => {
    const list = await ketoan.congNoList(apiAdmin, { loai: 'phai_tra' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((r) => r.id === 'CN-GD3-1')).toBe(true);
    expect(list.every((r) => typeof r.tuoi_no === 'number')).toBe(true);
  });

  test('phieuChiCreate CHẶN công nợ mua hàng chưa có HĐĐT đầu vào', async () => {
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('CN-GD3-3','phai_tra','NCC C','CN','phieu_nhap','PN-GD3-9','2026-09-05',1000,0,1000)"
    );
    const res = await ketoan.phieuChiCreate(apiAdmin, { cong_no_id: 'CN-GD3-3', so_tien: 200 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HĐĐT|HÓA ĐƠN/i);
    const pc = await dal.row<{ id: string }>("SELECT id FROM phieu_chi WHERE cong_no_id='CN-GD3-3' AND deleted_at=''");
    expect(pc).toBeFalsy();
  });

  test('phieuChiCreate CHO PHÉP sau khi có HĐĐT đầu vào', async () => {
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('CN-GD3-4','phai_tra','NCC D','CN','phieu_nhap','PN-GD3-10','2026-09-06',1000,0,1000)"
    );
    await dal.run(
      "INSERT INTO vat_invoice(id, ncc, so_hd, ngay, tien_hang, tien_thue, ty_le, ref_id) VALUES('VAT-GD3-1','NCC D','HD-GD3-9', '2026-09-06', 1000, 100, 10, 'PN-GD3-10')"
    );
    const res = await ketoan.phieuChiCreate(apiAdmin, { cong_no_id: 'CN-GD3-4', so_tien: 200 });
    expect(res.ok).toBe(true);
    const pc = await dal.row<{ id: string }>("SELECT id FROM phieu_chi WHERE cong_no_id='CN-GD3-4' AND deleted_at=''");
    expect(pc).toBeTruthy();
  });

  test('congNoChuaCoHoaDon chỉ liệt kê công nợ mua hàng thiếu HĐĐT', async () => {
    const list = await ketoan.congNoChuaCoHoaDon(apiAdmin);
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((r) => r.id === 'CN-GD3-3')).toBe(true);
    expect(list.some((r) => r.id === 'CN-GD3-4')).toBe(false);
    expect(list.some((r) => r.id === 'CN-GD3-1')).toBe(false);
  });

  test('phieuChiCreate ghi nhận cp_ve_phuphi', async () => {
    await dal.run(
      "INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no) VALUES('CN-GD3-5','phai_tra','NCC E','CN','x','x','2026-09-07',1000,0,1000)"
    );
    const res = await ketoan.phieuChiCreate(apiAdmin, { cong_no_id: 'CN-GD3-5', so_tien: 100, cp_ve_phuphi: 50 });
    expect(res.ok).toBe(true);
    const pc = await dal.row<{ cp_ve_phuphi: number }>(
      "SELECT cp_ve_phuphi FROM phieu_chi WHERE cong_no_id='CN-GD3-5' AND deleted_at='' LIMIT 1"
    );
    expect(Number(pc?.cp_ve_phuphi)).toBeCloseTo(50, 2);
  });
});

/* ============================================================ */
describe('v4.3 P4 — Sổ quỹ / Phiếu thu (port ledger-gd4)', () => {
  test('B5 phieuThuCreate: thu nội bộ ghi so_quy + bút toán cân bằng', async () => {
    const r = await ledger.phieuThuCreate(apiAdmin, {
      ngay: '2027-01-15',
      loai_quy: 'tm',
      doi_tac: 'NCC X',
      so_tien: 500000,
      ly_do: 'Thu hồi vật tư',
    });
    expect(r.ok).toBe(true);
    expect(r.id).toBeTruthy();
    const sq = await dal.row<{ loai_ps: string; so_tien: number }>('SELECT loai_ps, so_tien FROM so_quy WHERE id=$1', r.id);
    expect(sq!.loai_ps).toBe('thu');
    expect(Number(sq!.so_tien)).toBe(500000);
    // ledger PT: Nợ 111, Có 331
    const lt = await dal.rows<{ tai_khoan: string; du_no: number; du_co: number }>(
      "SELECT tai_khoan, du_no, du_co FROM ledger WHERE ref_id=$1 AND deleted_at=''",
      r.id
    );
    expect(lt.length).toBe(2);
    const no = lt.find((x) => x.du_no > 0);
    const co = lt.find((x) => x.du_co > 0);
    expect(no!.tai_khoan).toBe('111');
    expect(co!.tai_khoan).toBe('331');
    expect(Number(no!.du_no)).toBe(500000);
    expect(Number(co!.du_co)).toBe(500000);
  });

  test('B5 từ chối số tiền <= 0', async () => {
    const r = await ledger.phieuThuCreate(apiAdmin, { ngay: '2027-01-15', loai_quy: 'tm', so_tien: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/phải > 0/);
  });

  test('B5 từ chối khi thiếu quyền (role tho)', async () => {
    const r = await ledger.phieuThuCreate(apiTho, { ngay: '2027-01-15', loai_quy: 'tm', so_tien: 100 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Không đủ quyền/);
  });

  test('B6 ledgerReport trả so_quy với thu/chi đúng (cửa sổ riêng 2027-02)', async () => {
    await ledger.phieuThuCreate(apiAdmin, { ngay: '2027-02-02', loai_quy: 'tm', so_tien: 500000, ly_do: 'A' });
    const rep = await ketoan.ledgerReport(apiAdmin, { tu_ngay: '2027-02-01', den_ngay: '2027-02-28' });
    expect(rep.so_quy.thu).toBe(500000);
    expect(rep.so_quy.chi).toBe(0);
    expect(rep.so_quy.rows.length).toBe(1);
  });
});

/* ============================================================ */
describe('ketoan GĐ4 — Báo cáo & Khóa kỳ (port ketoan-gd3 GĐ4 part)', () => {
  test('ledgerReport trả CĐKT cân bằng (Tài sản = Nguồn vốn)', async () => {
    const rep = await ketoan.ledgerReport(apiAdmin, {});
    expect(Array.isArray(rep.cdkt)).toBe(true);
    expect(rep.cdkt.length).toBeGreaterThan(0);
    expect(rep.tong_tai_san).toBeCloseTo(rep.tong_nguon, 2);
    expect(ketoan.buildReportHtml(rep)).toContain('BÁO CÁO');
  });

  test('kyClose khóa kỳ → ledgerPost trong kỳ bị từ chối', async () => {
    const ok = await ketoan.kyClose(apiAdmin, { ten_ky: 'T08/2026', tu_ngay: '2026-08-01', den_ngay: '2026-08-31' });
    expect(ok.ok).toBe(true);
    expect(ok.id).toBeTruthy();
    const post = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'CT-BLOCK',
      ngay: '2026-08-15',
      loai_ct: 'test',
      entries: [{ tai_khoan: '152', du_no: 1 }, { tai_khoan: '331', du_co: 1 }],
    });
    expect(post.ok).toBe(false);
    expect(post.error).toMatch(/đóng/i);
    const okPost = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'CT-OK',
      ngay: '2026-09-15',
      loai_ct: 'test',
      entries: [{ tai_khoan: '152', du_no: 1 }, { tai_khoan: '331', du_co: 1 }],
    });
    expect(okPost.ok).toBe(true);
  });

  test('kyOpen mở lại kỳ → ledgerPost trong kỳ được ghi', async () => {
    const open = await ketoan.kyOpen(apiAdmin, { ten_ky: 'T08/2026' });
    expect(open.ok).toBe(true);
    const post = await ledger.ledgerPost(apiAdmin, {
      so_ct: 'CT-OPEN',
      ngay: '2026-08-16',
      loai_ct: 'test',
      entries: [{ tai_khoan: '152', du_no: 1 }, { tai_khoan: '331', du_co: 1 }],
    });
    expect(post.ok).toBe(true);
  });

  test('kyClose từ chối ngày sai định dạng / thiếu tên kỳ', async () => {
    const r = await ketoan.kyClose(apiAdmin, { ten_ky: '', tu_ngay: '2026-13-99', den_ngay: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/YYYY-MM-DD/);
  });
});
