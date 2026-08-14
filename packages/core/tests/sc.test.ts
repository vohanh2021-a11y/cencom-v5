/**
 * sc.test.ts — Conformance module Sửa chữa (port sc.js → sc.ts):
 * state machine 8 bước: tạo → duyệt → tổng duyệt → bắt đầu → hoàn → nghiệm thu,
 * recalc tổng, kt/kh, danh mục công việc, và các "đường chết" bắt buộc giữ.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeCtx, type TestCtx } from './helpers.js';
import {
  scCreate,
  scGet,
  scApprove,
  scTongDuyet,
  scStart,
  scSetDeadline,
  scWorkSet,
  scWorkAdd,
  scWorkDel,
  scVtAdd,
  scVtUpd,
  scVtDel,
  scFinish,
  scNghiem,
  ktSave,
  khSave,
  khApplyToSC,
  congViecSave,
  congViecDel,
  congViecList,
} from '../src/sc.js';
import { seedPerms } from '../src/perm.js';

let ctx: TestCtx;
const BKS = '37H-09917';

beforeAll(async () => {
  ctx = await makeCtx();
  await seedPerms(ctx.db);
}, 60000);

afterEach(() => {
  ctx.setActor(null);
});

function asAdmin(): void {
  ctx.setActor({ id: 'admin-1', name: 'Admin', role: 'admin' });
}
function asQuanly(): void {
  ctx.setActor({ id: 'quanly-1', name: 'Quản lý', role: 'quanly' });
}
function asTho(): void {
  ctx.setActor({ id: 'tho-1', name: 'Thợ 1', role: 'tho' });
}

describe('scCreate — tạo phiếu', () => {
  it('tạo phiếu de_xuat + recalc tổng từ CV & vật tư', async () => {
    asAdmin();
    const r = await scCreate(ctx, {
      bks: BKS,
      mo_ta: 'Bảo dưỡng định kỳ',
      congviec: [{ congviec_id: 1, so_luong: 2, don_gia: 50000 }], // cv seed id=1
      vattu: [{ vattu_id: 1, so_luong: 3, gd_dk: 20000 }],
    });
    expect(r.ok).toBe(true);
    expect(r.id).toMatch(/^SC-\d{6}$/);

    const detail = await scGet(ctx, r.id!);
    expect(detail).not.toBeNull();
    expect(detail!.sc.trang_thai).toBe('de_xuat');
    // 2*50000 + 3*20000 = 160000
    expect(detail!.sc.tong).toBe(160000);
    expect(detail!.cong.length).toBe(1);
    expect(detail!.vat.length).toBe(1);
  });

  it('thiếu bks / xe chưa có → error', async () => {
    asAdmin();
    expect((await scCreate(ctx, {})).ok).toBe(false);
    const r2 = await scCreate(ctx, { bks: '99Z-99999' });
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain('Chưa có xe');
  });

  it('không đủ quyền → throw', async () => {
    // laixe chỉ có tk/xe/chat — không có sc.tao → checkLock ném lỗi
    ctx.setActor({ id: 'laixe-1', name: 'Lái xe 1', role: 'laixe' });
    await expect(scCreate(ctx, { bks: BKS })).rejects.toThrow('Không đủ quyền');
  });

  it('tạo SC thứ 2 từ 1 TK → vẫn OK (quyết định giữ v3.6: chỉ báo qua tk_createSC)', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, tk_id: 'TK-000001' });
    expect(r.ok).toBe(true);
  });
});

describe('scApprove — duyệt theo ngưỡng', () => {
  it('quanly duyệt phiếu dưới ngưỡng 5tr', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, congviec: [{ ten: 'Thay lọc dầu', don_gia: 100000 }] });
    asQuanly();
    const ap = await scApprove(ctx, r.id!, 'ok');
    expect(ap.ok).toBe(true);
    expect(ap.trang_thai).toBe('da_duyet');
  });

  it('duyệt phiếu đã duyệt → error', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    asQuanly();
    await scApprove(ctx, r.id!, 'ok');
    const again = await scApprove(ctx, r.id!, 'ok');
    expect(again.ok).toBe(false);
    expect(again.error).toContain('không duyệt được');
  });

  it('từ chối → tu_choi + ghi lý do', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    asQuanly();
    const ap = await scApprove(ctx, r.id!, 'no', 'Thiếu hồ sơ');
    expect(ap.trang_thai).toBe('tu_choi');
    const d = await scGet(ctx, r.id!);
    expect(d!.sc.ly_do_tu_choi).toContain('Thiếu hồ sơ');
  });
});

describe('scTongDuyet — chốt kế hoạch + snapshot', () => {
  it('từ da_duyet → da_tong_duyet + snapshot lưu sc_phien_ban', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, congviec: [{ ten: 'CV A', don_gia: 100000 }] });
    await scApprove(ctx, r.id!, 'ok');
    const td = await scTongDuyet(ctx, r.id!, 'ok');
    expect(td.ok).toBe(true);
    expect(td.snapshot).toBe(true);
    const snap = await ctx.db.row<{ snapshot: string }>(
      "SELECT snapshot FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    expect(snap).toBeDefined();
    const parsed = JSON.parse(snap!.snapshot);
    expect(parsed.sc.id).toBe(r.id);
    expect(parsed.chot.nguoi).toBe('admin-1');
  });

  it('không ở da_duyet → error (đường chết #16)', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    const td = await scTongDuyet(ctx, r.id!, 'ok');
    expect(td.ok).toBe(false);
    expect(td.error).toContain('chỉ tổng duyệt khi Đã duyệt');
  });
});

describe('scStart + deadline', () => {
  it('scStart từ da_tong_duyet → dang_sua (tự snapshot nếu thiếu)', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, congviec: [{ ten: 'CV B', don_gia: 100000 }] });
    await scApprove(ctx, r.id!, 'ok');
    // không tổng duyệt — scStart tự snapshot
    const st = await scStart(ctx, r.id!);
    expect(st.ok).toBe(true);
    const d = await scGet(ctx, r.id!);
    expect(d!.sc.trang_thai).toBe('dang_sua');
    expect(d!.sc.ngay_bat_dau).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('scSetDeadline chỉ xuong/giamdoc/admin + validate YYYY-MM-DD', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    await scApprove(ctx, r.id!, 'ok');
    const sd = await scSetDeadline(ctx, r.id!, '2026-09-01');
    expect(sd.ok).toBe(true);
    expect(sd.ngay_du_kien).toBe('2026-09-01');
    expect((await scSetDeadline(ctx, r.id!, '01/09/2026')).ok).toBe(false);
  });
});

describe('scWorkSet/Add/Del + scVtAdd/Upd/Del', () => {
  it('thêm CV, cập nhật trạng thái hoan, xoá mềm', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    const wa = await scWorkAdd(ctx, r.id!, { name: 'CV mới', don_gia: 50000 });
    expect(wa.ok).toBe(true);
    const cvRows = await ctx.db.rows<{ id: number }>(
      "SELECT id FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    const cvId = cvRows[0]!.id;
    const ws = await scWorkSet(ctx, r.id!, cvId, { tt: 'hoan' });
    expect(ws.ok).toBe(true);
    const row = await ctx.db.row<{ tt: string }>('SELECT tt FROM sc_congviec WHERE id=$1', cvId);
    expect(row!.tt).toBe('hoan');
    const wd = await scWorkDel(ctx, r.id!, cvId);
    expect(wd.ok).toBe(true);
  });

  it('scWorkSet tt ngoài whitelist → error (đường chết #13)', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    const wa = await scWorkAdd(ctx, r.id!, { name: 'CV X' });
    expect(wa.ok).toBe(true);
    const cvRows = await ctx.db.rows<{ id: number }>(
      "SELECT id FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    const ws = await scWorkSet(ctx, r.id!, cvRows[0]!.id, { tt: 'khong_hop_le' });
    expect(ws.ok).toBe(false);
  });

  it('vật tư thêm/cập nhật gd_tt → recalc', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    await scVtAdd(ctx, r.id!, { name: 'Dầu nhớt', so_luong: 2, gd_dk: 30000 });
    const vtRows = await ctx.db.rows<{ id: number }>(
      "SELECT id FROM sc_vattu WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    const vtId = vtRows[0]!.id;
    await scVtUpd(ctx, r.id!, vtId, { gd_tt: 35000 });
    const d = await scGet(ctx, r.id!);
    expect(d!.sc.tong_vt).toBe(70000);
    expect((await scVtDel(ctx, r.id!, vtId)).ok).toBe(true);
  });
});

describe('scFinish + scNghiem', () => {
  it('scFinish còn CV chưa hoan → error (đường chết #9)', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, congviec: [{ ten: 'CV còn dở' }] });
    await scApprove(ctx, r.id!, 'ok');
    await scStart(ctx, r.id!);
    const f = await scFinish(ctx, r.id!);
    expect(f.ok).toBe(false);
    expect(f.error).toContain('Còn công việc chưa hoàn thành');
  });

  it('tất cả CV hoan → cho_nghiem → nghiệm thu đạt → da_hoan + biên bản', async () => {
    asAdmin();
    const r = await scCreate(ctx, {
      bks: BKS,
      congviec: [{ ten: 'CV 1', don_gia: 100000 }],
      vattu: [{ ten: 'VT 1', so_luong: 1, gd_dk: 50000 }],
    });
    await scApprove(ctx, r.id!, 'ok');
    await scStart(ctx, r.id!);
    const cvRows = await ctx.db.rows<{ id: number }>(
      "SELECT id FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    await scWorkSet(ctx, r.id!, cvRows[0]!.id, { tt: 'hoan' });
    const f = await scFinish(ctx, r.id!);
    expect(f.ok).toBe(true);
    const d1 = await scGet(ctx, r.id!);
    expect(d1!.sc.trang_thai).toBe('cho_nghiem');

    const ng = await scNghiem(ctx, r.id!, true, '', {
      ben_giao: 'Xưởng A',
      ben_nhan: 'Đội xe',
      lai_xe: 'Lái xe 1',
      bao_hanh_ngay: '30',
      ket_luan: 'Đạt',
    });
    expect(ng.ok).toBe(true);
    const d2 = await scGet(ctx, r.id!);
    expect(d2!.sc.trang_thai).toBe('da_hoan');
    expect(d2!.bienBanNghiem).not.toBeNull();
  });

  it('nghiệm thu không đạt → quay lại dang_sua', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, congviec: [{ ten: 'CV 2' }] });
    await scApprove(ctx, r.id!, 'ok');
    await scStart(ctx, r.id!);
    const cvRows = await ctx.db.rows<{ id: number }>(
      "SELECT id FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    await scWorkSet(ctx, r.id!, cvRows[0]!.id, { tt: 'hoan' });
    await scFinish(ctx, r.id!);
    const ng = await scNghiem(ctx, r.id!, false, 'Làm lại phần điện');
    expect(ng.ok).toBe(true);
    const d = await scGet(ctx, r.id!);
    expect(d!.sc.trang_thai).toBe('dang_sua');
  });

  it('chỉ admin/quanly/giamdoc nghiệm thu (đường quyền)', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS, congviec: [{ ten: 'CV 3' }] });
    await scApprove(ctx, r.id!, 'ok');
    await scStart(ctx, r.id!);
    const cvRows = await ctx.db.rows<{ id: number }>(
      "SELECT id FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
      r.id
    );
    await scWorkSet(ctx, r.id!, cvRows[0]!.id, { tt: 'hoan' });
    await scFinish(ctx, r.id!);
    asTho();
    const ng = await scNghiem(ctx, r.id!, true);
    expect(ng.ok).toBe(false);
    expect(ng.error).toContain('Chỉ quản lý/Giám đốc');
  });
});

describe('ktSave + khSave/khApplyToSC', () => {
  it('lưu bản kiểm tu + kế hoạch SC (mẫu 01) + apply khi chưa có dòng', async () => {
    asAdmin();
    const r = await scCreate(ctx, { bks: BKS });
    const kt = await ktSave(ctx, { sc_id: r.id, chi_tiet: [{ item: 'Phanh', ok: true }], ket_luan: 'Đạt' });
    expect(kt.ok).toBe(true);
    expect(kt.id).toMatch(/^KT-\d{6}$/);

    const kh = await khSave(ctx, {
      sc_id: r.id,
      hang_muc: JSON.stringify([
        { loai: 'cv', cat_id: 1, so_luong: 1, don_gia: 100000 },
        { loai: 'vt', vattu_id: 1, so_luong: 2, don_gia: 20000 },
      ]),
      tong_du_kien: 140000,
    });
    expect(kh.ok).toBe(true);
    const applied = await khApplyToSC(ctx.db, r.id!);
    expect(applied).toBe(true);
    const d = await scGet(ctx, r.id!);
    expect(d!.cong.length).toBe(1);
    expect(d!.vat.length).toBe(1);
    expect(d!.sc.tong).toBe(140000);
  });
});

describe('danh mục công việc', () => {
  it('congViecList + Save (tạo mới) + Del', async () => {
    asAdmin();
    const list = await congViecList(ctx);
    expect(list.length).toBeGreaterThan(0);
    const sv = await congViecSave(ctx, { name: 'Công việc mới', don_gia: 123000, nhom: 'Bảo dưỡng' });
    expect(sv.ok).toBe(true);
    expect(sv.id).toBeGreaterThan(0);
    const del = await congViecDel(ctx, sv.id!);
    expect(del.ok).toBe(true);
  });

  it('congViecSave thiếu tên → error', async () => {
    asAdmin();
    expect((await congViecSave(ctx, {})).ok).toBe(false);
  });
});