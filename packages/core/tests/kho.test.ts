/**
 * kho.test.ts — Test module Kho & Mua sắm (port server/kho.js v3.6).
 * Bối cảnh: PGlite + schema + seed; actor mặc định admin.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import * as kho from '../src/kho.js';
import * as sc from '../src/sc.js';

const BKS = '37H-09917';

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeCtx();
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

// Reset actor sau mỗi test — tránh nhiễm quyền giữa các test (kho.test set ketoan/giamdoc).
afterEach(() => {
  ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
});

describe('danh mục vật tư', () => {
  it('vatTuList có seed + vatTuSave tạo mới', async () => {
    const list = await kho.vatTuList(ctx);
    expect(list.length).toBeGreaterThan(20);
    const r = await kho.vatTuSave(ctx, { name: 'Dầu hộp số 75W-90', code: 'VT-TEST1', nhom: 'Nhớt', donvi: 'lít', gia: 130000, ton: 10, ton_min: 5 });
    expect(r.ok).toBe(true);
    expect(r.id).toBeTruthy();
    const v = await ctx.db.row<{ id: number; code: string }>('SELECT id, code FROM vattu WHERE code=$1', 'VT-TEST1');
    expect(v).toBeTruthy();
  });

  it('vatTuSave code trùng → cập nhật thay vì tạo mới', async () => {
    await kho.vatTuSave(ctx, { name: 'VT001 X', code: 'vt001', nhom: 'Nhớt', gia: 52000 });
    const rows = await ctx.db.rows<{ id: number }>('SELECT id FROM vattu WHERE code=$1', 'VT001');
    expect(rows.length).toBe(1);
  });

  it('vatTuDel vật tư chưa dùng → xoá mềm', async () => {
    const r = await kho.vatTuSave(ctx, { name: 'VT xoá test', code: 'VT-DEL1', gia: 1000 });
    const r2 = await kho.vatTuDel(ctx, r.id!);
    expect(r2.ok).toBe(true);
    const v = await ctx.db.row<{ deleted_at: string }>('SELECT deleted_at FROM vattu WHERE id=$1', r.id!);
    expect(v!.deleted_at).not.toBe('');
  });

  it('vatTuDel vật tư đã có phiếu nhập → lỗi', async () => {
    // VT001 đã có ton seed 60 — chưa có phiếu nhập, tạo 1 phiếu nhập trước
    const v = await ctx.db.row<{ id: number }>("SELECT id FROM vattu WHERE code='VT001'");
    await ctx.db.run(
      'INSERT INTO phieu_nhap(id, ngay, nguoi_lap, tong) VALUES($1,$2,$3,0)',
      'PXN-DEL1', ctx.db.today(), 'admin'
    );
    await ctx.db.run(
      'INSERT INTO phieu_nh_ct(ph_id, vattu_id, ten, so_luong, dgia, thanh) VALUES($1,$2,$3,1,100,100)',
      'PXN-DEL1', v!.id, 'Dầu động cơ'
    );
    const r = await kho.vatTuDel(ctx, v!.id);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('không thể xoá');
  });
});

describe('tồn kho', () => {
  it('tonKho tính low + giá trị tồn kho', async () => {
    const t = await kho.tonKho(ctx);
    expect(t.rows.length).toBeGreaterThan(20);
    expect(t.lowCount).toBeGreaterThanOrEqual(0);
    expect(t.giaTriTonKho).toBeGreaterThan(0);
  });
});

describe('đề nghị mua', () => {
  it('dmCreate + dmList + dmDetail', async () => {
    const r = await kho.dmCreate(ctx, {
      items: [{ vattu_id: 1, so_luong: 2, dgia: 52000 }, { name: 'Vật tư lạ', so_luong: 1, dgia: 10000 }],
      ghi_chu: 'Test DM',
    });
    expect(r.ok).toBe(true);
    expect(r.id).toMatch(/^DNM-/);
    expect(r.tong).toBe(114000);
    const list = await kho.dmList(ctx);
    expect(list.some((d) => d.id === r.id)).toBe(true);
    const dt = await kho.dmDetail(ctx, r.id!);
    expect(dt!.ct.length).toBe(2);
  });

  it('dmDecide: ketoan duyệt dưới ngưỡng / giamdoc trên ngưỡng', async () => {
    await ctx.db.configSet('duyet_mua_nguong', '500000');
    const r = await kho.dmCreate(ctx, { items: [{ name: 'VT nho', so_luong: 1, dgia: 100000 }] });
    ctx.setActor({ id: 'ketoan', name: 'Kế toán', role: 'ketoan' });
    const ok = await kho.dmDecide(ctx, r.id!, 'ok');
    expect(ok.ok).toBe(true);
    expect(ok.trang_thai).toBe('da_duyet');
    // hết quyền: đã xử lý rồi
    const again = await kho.dmDecide(ctx, r.id!, 'ok');
    expect(again.ok).toBe(false);

    // trên ngưỡng → ketoan từ chối, giamdoc duyệt
    const big = await kho.dmCreate(ctx, { items: [{ name: 'VT lon', so_luong: 2, dgia: 400000 }] });
    const denied = await kho.dmDecide(ctx, big.id!, 'ok');
    expect(denied.ok).toBe(false);
    ctx.setActor({ id: 'giamdoc', name: 'Giám đốc', role: 'giamdoc' });
    const ok2 = await kho.dmDecide(ctx, big.id!, 'ok');
    expect(ok2.ok).toBe(true);
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });

  it('dmDecide không đủ quyền → throw từ checkLock', async () => {
    const r = await kho.dmCreate(ctx, { items: [{ name: 'VT 3', so_luong: 1, dgia: 100000 }] });
    ctx.setActor({ id: 'tho-1', name: 'Thợ', role: 'tho' });
    // tho không có quyền mua.duy → checkLock throw (giống v3.6)
    await expect(kho.dmDecide(ctx, r.id!, 'ok')).rejects.toThrow('Không đủ quyền: cần mua.duy');
    ctx.setActor({ id: 'admin', name: 'Admin', role: 'admin' });
  });

  it('dmDelete: sau khi nhập kho → lỗi', async () => {
    const r = await kho.dmCreate(ctx, { items: [{ name: 'VT 4', so_luong: 1, dgia: 100000 }] });
    await ctx.db.run("UPDATE de_nghi_mua SET trang_thai='da_duyet' WHERE id=$1", r.id!);
    await ctx.db.run(
      "INSERT INTO phieu_nhap(id, ngay, nguoi_lap, ref_dm, tong) VALUES($1,$2,$3,$4,100000)",
      'PXN-DEL2', ctx.db.today(), 'admin', r.id!
    );
    const d = await kho.dmDelete(ctx, r.id!);
    expect(d.ok).toBe(false);
    expect(d.error).toContain('phiếu nhập');
  });

  it('dmAutoBu: tạo DM bổ sung tồn tối thiểu', async () => {
    await kho.vatTuSave(ctx, { name: 'VT thấp tồn', code: 'VT-LOW1', gia: 10000, ton: 1, ton_min: 10 });
    const r = await kho.dmAutoBu(ctx);
    expect(r.ok).toBe(true);
    expect(r.id).toBeTruthy();
  });

  it('dmFromBaoGia trả lỗi (v4 bỏ AI-OCR)', async () => {
    const r = await kho.dmFromBaoGia(ctx, 'SC-000001');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('bỏ');
  });
});

describe('nhập kho / xuất kho', () => {
  it('phNhapCreate tăng tồn + ghi giá lịch sử + tự xuất khi đủ SC', async () => {
    // tạo SC có 1 vật tư cần mua
    const sr = await sc.scCreate(ctx, { bks: BKS, vattu: [{ vattu_id: 1, so_luong: 2, gd_dk: 52000 }] });
    expect(sr.ok).toBe(true);
    await sc.scApprove(ctx, sr.id!, 'ok');
    // nhập 2 đơn vị VT001 cho SC
    const r = await kho.phNhapCreate(ctx, {
      items: [{ vattu_id: 1, so_luong: 2, dgia: 52000, sc_id: sr.id! }],
      nha_cc: 'Cửa hàng A',
    });
    expect(r.ok).toBe(true);
    expect(r.id).toMatch(/^PXN-/);
    // tồn VT001: nhập +2 rồi autoXuatSC xuất đúng 2 → về 60 (giữ nguyên ban đầu)
    const v = await ctx.db.row<{ ton: number }>('SELECT ton FROM vattu WHERE id=$1', 1);
    expect(v!.ton).toBe(60);
    // giá lịch sử có dòng
    const gls = await kho.giaLichSuList(ctx, 1);
    expect(gls.length).toBeGreaterThan(0);
    // sc_vattu → da_mua rồi autoXuatSC (nhập đủ) → da_xuat + PXX
    const sv = await ctx.db.row<{ tt: string }>('SELECT tt FROM sc_vattu WHERE sc_id=$1 AND vattu_id=$2', sr.id!, 1);
    expect(sv!.tt).toBe('da_xuat');
    const pxx = await ctx.db.row<{ id: string }>("SELECT id FROM phieu_xuat WHERE ref_sc=$1", sr.id!);
    expect(pxx).toBeTruthy();
  });

  it('phNhapCreate thiếu dòng → lỗi', async () => {
    const r = await kho.phNhapCreate(ctx, { items: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Không có dòng hàng');
  });

  it('phNhapCreate từ ref_dm chưa duyệt → lỗi', async () => {
    const dm = await kho.dmCreate(ctx, { items: [{ name: 'VT 5', so_luong: 1, dgia: 100000 }] });
    const r = await kho.phNhapCreate(ctx, { ref_dm: dm.id!, nha_cc: 'X' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('chưa duyệt');
  });

  it('phNhapGet/List trả hồ sơ', async () => {
    const list = await kho.phNhapList(ctx);
    expect(list.length).toBeGreaterThan(0);
    const g = await kho.phNhapGet(ctx, list[0]!.id);
    expect(g!.ph.id).toBe(list[0]!.id);
  });

  it('phXuatCreate xuất kho giảm tồn; thiếu tồn → throw', async () => {
    const before = await ctx.db.row<{ ton: number }>('SELECT ton FROM vattu WHERE id=$1', 2);
    const r = await kho.phXuatCreate(ctx, { items: [{ vattu_id: 2, so_luong: 5 }], nguoi_nhan: 'Nguyễn Văn A' });
    expect(r.ok).toBe(true);
    expect(r.id).toMatch(/^PXX-/);
    const after = await ctx.db.row<{ ton: number }>('SELECT ton FROM vattu WHERE id=$1', 2);
    expect(after!.ton).toBe(before!.ton - 5);
    // xuất vượt tồn → throw (port nguyên v3.6)
    await expect(
      kho.phXuatCreate(ctx, { items: [{ vattu_id: 2, so_luong: 99999 }] })
    ).rejects.toThrow('Không đủ tồn');
  });

  it('phXuatCreate loại cu_hong dùng ton_cu_hong', async () => {
    // đưa 10 vào kho hư hỏng
    await ctx.db.run('UPDATE vattu SET ton_cu_hong = ton_cu_hong + 10 WHERE id=$1', 3);
    const r = await kho.phXuatCreate(ctx, { loai_xuat: 'cu_hong', items: [{ vattu_id: 3, so_luong: 4 }] });
    expect(r.ok).toBe(true);
    expect(r.tong).toBe(0);
    const v = await ctx.db.row<{ ton_cu_hong: number }>('SELECT ton_cu_hong FROM vattu WHERE id=$1', 3);
    expect(v!.ton_cu_hong).toBe(6);
  });

  it('autoGenCuHong: SC có vt loại thay thế → PXN cu_hong + thanh lý', async () => {
    const sr = await sc.scCreate(ctx, {
      bks: BKS,
      vattu: [{ vattu_id: 4, so_luong: 3, gd_dk: 95000, loai_xu_ly: 'thay_the' }],
    });
    await sc.scApprove(ctx, sr.id!, 'ok');
    await sc.scStart(ctx, sr.id!);
    const r = await kho.autoGenCuHong(ctx, sr.id!);
    expect(r.ok).toBe(true);
    expect(r.so_dong).toBe(1);
    const v = await ctx.db.row<{ ton_cu_hong: number }>('SELECT ton_cu_hong FROM vattu WHERE id=$1', 4);
    expect(v!.ton_cu_hong).toBe(3);
    // tạo lần 2 → lỗi (đã có)
    const again = await kho.autoGenCuHong(ctx, sr.id!);
    expect(again.ok).toBe(false);
    expect(again.error).toContain('đã tạo');
  });

  it('autoGenCuHong SC sai trạng thái → lỗi', async () => {
    const sr = await sc.scCreate(ctx, {
      bks: BKS,
      vattu: [{ vattu_id: 5, so_luong: 1, gd_dk: 1000, loai_xu_ly: 'thay_the' }],
    });
    // chưa duyệt → trang_thai de_xuat → không cho tạo
    const r = await kho.autoGenCuHong(ctx, sr.id!);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('đang sửa');
  });

  it('thanhLyList lọc theo SC', async () => {
    const sr = await sc.scCreate(ctx, {
      bks: BKS,
      vattu: [{ vattu_id: 6, so_luong: 2, gd_dk: 1000, loai_xu_ly: 'thay_the' }],
    });
    await sc.scApprove(ctx, sr.id!, 'ok');
    await sc.scStart(ctx, sr.id!);
    await kho.autoGenCuHong(ctx, sr.id!);
    const list = await kho.thanhLyList(ctx, { sc_id: sr.id! });
    expect(list.length).toBeGreaterThan(0);
  });

  it('dmListBySc trả DM liên kết SC', async () => {
    // tạo SC có vt can_mua rồi dmFromSC
    const sr = await sc.scCreate(ctx, { bks: BKS, vattu: [{ vattu_id: 7, so_luong: 2, gd_dk: 1000 }] });
    const dm = await kho.dmFromSC(ctx, sr.id!);
    expect(dm.ok).toBe(true);
    const list = await kho.dmListBySc(ctx, sr.id!);
    expect(list.some((d) => d.id === dm.id)).toBe(true);
  });
});
