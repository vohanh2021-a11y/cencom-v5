/**
 * asset.test.ts — Test Quyết toán sửa chữa + Lý lịch + GTTV (port server/asset.js v3.6).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as asset from '../src/asset.js';
import * as sc from '../src/sc.js';
import * as kho from '../src/kho.js';

const BKS = '37H-09917';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

/** Tạo SC hoàn tất (da_hoan + biên bản nghiệm thu) + đủ hồ sơ kho để quyết toán được. */
async function makeSCDone(): Promise<{ scId: string; vtId: number; vtName: string }> {
  const r = await sc.scCreate(ctx, {
    bks: BKS,
    mo_ta: 'Sửa chữa động cơ (đủ hồ sơ)',
  });
  expect(r.ok).toBe(true);
  const scId = r.id!;

  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  const ap = await sc.scApprove(ctx, scId, 'ok');
  expect(ap.ok).toBe(true);
  const st = await sc.scStart(ctx, scId);
  expect(st.ok).toBe(true);
  // Thêm công việc + hoàn thành để scFinish không chặn
  const wk = await sc.scWorkAdd(ctx, scId, { name: 'Thay máy nổ', so_luong: 1, don_gia: 1000000 });
  expect(wk.ok).toBe(true);
  await ctx.db.run("UPDATE sc_congviec SET tt='hoan' WHERE sc_id=$1", scId);
  const fn = await sc.scFinish(ctx, scId);
  expect(fn.ok).toBe(true);
  const ng = await sc.scNghiem(ctx, scId, true, '', { ben_giao: 'Gara A', ben_nhan: 'Công ty X' });
  expect(ng.ok).toBe(true);

  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });

  // Hồ sơ kho: báo giá NCC → ĐM → nhập kho → xuất kho
  await ctx.db.run(
    "INSERT INTO bao_gia_ncc(sc_id, ncc_ten, ngay, loai_chung_tu, nguoi_lap) VALUES($1,$2,$3,'bao_gia',$4)",
    scId, 'NCC Tùng Lâm', ctx.db.today(), 'admin'
  );
  const vat = await ctx.db.row<{ id: number; name: string }>(
    "SELECT id, name FROM vattu WHERE deleted_at='' AND ton>0 ORDER BY id LIMIT 1"
  );
  const vtId = vat!.id;
  const dm = await kho.dmCreate(ctx, {
    items: [{ vattu_id: vtId, so_luong: 1, dgia: 50000 }],
    ghi_chu: 'Vật tư cho ' + scId,
  });
  expect(dm.ok).toBe(true);
  const dmId = dm.id!;
  ctx.setActor({ id: 'ketoan-1', name: 'Kế toán', role: 'ketoan' });
  const dec = await kho.dmDecide(ctx, dmId, 'ok');
  expect(dec.ok).toBe(true);
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  await ctx.db.run("UPDATE bao_gia_ncc SET dm_id=$1 WHERE sc_id=$2 AND dm_id=''", dmId, scId);
  const pn = await kho.phNhapCreate(ctx, { ref_dm: dmId, nha_cc: 'NCC Tùng Lâm' });
  expect(pn.ok).toBe(true);
  const px = await kho.phXuatCreate(ctx, { ref_sc: scId, items: [{ vattu_id: vtId, so_luong: 1 }] });
  expect(px.ok).toBe(true);
  return { scId, vtId, vtName: vat!.name };
}

describe('checkHoSo', () => {
  it('phiếu không tồn tại → miss phiếu sửa chữa', async () => {
    const hs = await asset.checkHoSo(ctx, 'SC-KHONG-CO');
    expect(hs.ok).toBe(false);
    expect(hs.miss).toContain('phiếu sửa chữa');
  });
});

describe('quyetToan', () => {
  it('chưa nghiệm thu → lỗi', async () => {
    const r = await sc.scCreate(ctx, { bks: BKS, mo_ta: 'Chưa nghiệm thu' });
    const out = await asset.quyetToan(ctx, { id: r.id! });
    expect(out.ok).toBe(false);
    expect(out.error).toContain('chưa nghiệm thu');
  });

  it('quyết toán thành công + chống trùng', async () => {
    const { scId } = await makeSCDone();
    const out = await asset.quyetToan(ctx, { id: scId, ghi_chu: 'Thanh toán tháng 8' });
    expect(out.ok).toBe(true);
    expect(typeof out.tong).toBe('number');
    const ls = await ctx.db.row<{ sc_id: string; tong: number; nguoi: string }>(
      "SELECT sc_id, tong, nguoi FROM lich_sua WHERE sc_id=$1 AND deleted_at=''", scId
    );
    expect(ls).toBeTruthy();
    const p = await ctx.db.row<{ trang_thai: string }>('SELECT trang_thai FROM phieu_sua WHERE id=$1', scId);
    expect(p!.trang_thai).toBe('da_quyet');
    const dup = await asset.quyetToan(ctx, { id: scId });
    expect(dup.ok).toBe(false);
    expect(dup.error).toMatch(/đã quyết toán|chưa nghiệm thu/);
  });
});

describe('lichSuaList / assetXe / assetReport', () => {
  it('lichSuaList lọc theo bks', async () => {
    const { scId } = await makeSCDone();
    await asset.quyetToan(ctx, { id: scId });
    const list = await asset.lichSuaList(ctx, { bks: BKS });
    expect(list.length).toBeGreaterThan(0);
  });

  it('assetXe tính GTTV = nguyên giá − khấu hao + chi phí tích lũy', async () => {
    const { scId } = await makeSCDone();
    await asset.quyetToan(ctx, { id: scId });
    const a = await asset.assetXe(ctx, BKS);
    expect(a).toBeTruthy();
    const d = a as Record<string, any>;
    expect(d.nguyen_gia).toBeGreaterThanOrEqual(0);
    expect(d.gttv).toBe(d.nguyen_gia - d.khau_hao + d.chi_phi_tich_luy);
    expect(d.khau_hao_nam).toBeGreaterThanOrEqual(1);
  });

  it('assetReport + cached trả tổng hợp', async () => {
    const rep = await asset.assetReportCached(ctx);
    const d = rep as Record<string, any>;
    expect(Array.isArray(d.rows)).toBe(true);
    expect(typeof d.tong.nguyen_gia).toBe('number');
    const rep2 = await asset.assetReportCached(ctx);
    expect(rep2).toBe(rep); // cache hit
  });
});

describe('ncNgoaiReport', () => {
  it('tổng hợp nhân công sửa ngoài theo đơn vị', async () => {
    const r = await sc.scCreate(ctx, { bks: BKS, mo_ta: 'Sửa ngoài' });
    const scId = r.id!;
    await sc.scWorkAdd(ctx, scId, { name: 'Công việc ngoài', so_luong: 2, don_gia: 300000 });
    await ctx.db.run("UPDATE phieu_sua SET la_sua_ngoai=1, don_vi_ngoai='Xưởng Hoàng Long' WHERE id=$1", scId);
    const out = await asset.ncNgoaiReport(ctx, { don_vi_ngoai: 'Hoàng' });
    expect(out.ok).toBe(true);
    expect(out.rows.length).toBeGreaterThan(0);
    const unit = out.tong.find((t) => t.don_vi === 'Xưởng Hoàng Long');
    expect(unit).toBeTruthy();
    expect(unit!.tien).toBe(600000);
  });
});