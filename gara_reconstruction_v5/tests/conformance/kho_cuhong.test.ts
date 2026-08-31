/**
 * W1c — KHO HƯ HỎNG CÁCH LY + THANH LÝ + AUTO THU HỒI + AUTO XUẤT ĐỦ
 * (lib/core/kho.ts: nhapKho/xuatKho nhánh cu_hong, thanhLyList, autoGenCuHong,
 * autoXuatSC — port v3.6 kho.js dòng 281–314 (autoXuatSC), 425–453 (phXuatCreate
 * cu_hong), 456–471 (thanhLyList), 478–512 (autoGenCuHong)).
 *
 * autoGenCuHong/autoXuatSC CHƯA wire RPC (lib/rpc.ts = worker-c; hook W3
 * scHoanThanh sẽ gọi nội bộ) → test GOI HAM CORE TRUC TIEP, pattern kế thừa
 * kho_tonkho.test.ts (không HTTP): buildApi role kho (ghi kho) + admin
 * (fixture xe/sc — role 'kho' không có sc.tao theo MATRIX).
 *
 * Cột is_test: fixture qua role 'kho' → is_test=0 (autoGen/autoXuat gọi bằng
 * apiKho → phiếu/nhân thanh lý is_test=0). Phân tách các suite song song bằng
 * MARK + assert THEO ID cụ thể (không tuyệt đối hóa COUNT toàn bảng).
 */
import { buildApi } from '../../lib/api';
import { db } from '../../lib/db';
import {
  vattuCreate, nhapKho, xuatKho, tonKho, thanhLyList,
  autoGenCuHong, autoXuatSC, THU_HOI_MARKER,
} from '../../lib/core/kho';
import { xeCreate } from '../../lib/core/xe';
import { scCreate, scAddVatTu, scBatDauSua, scHoanThanh } from '../../lib/core/sc';

const apiKho = buildApi({ id: 'U-KHO', name: 'kho', role: 'kho' });
const apiAdmin = buildApi({ id: 'U-ADMIN', name: 'admin', role: 'admin' });

const today = () => new Date().toISOString().split('T')[0];
const MARK = 'W1cVT';

const vtIds: string[] = [];
const scIds: string[] = [];

async function mkVattu(ten: string, gia: number | null): Promise<string> {
  const r = await vattuCreate(apiKho, { ten: `${MARK} ${ten}`, don_vi: 'cái', gia: gia ?? undefined, ton_min: 0 });
  vtIds.push(r.id);
  return r.id;
}

/** SC fixture bằng admin (kho không có sc.tao) → sc.is_test=1, các hàm auto
 *  không lọc is_test (parity v3.6) → tương tác bình thường. */
async function mkSc(nhan: string): Promise<string> {
  const xe = await xeCreate(apiAdmin, { bien_so: `${MARK}-XE${nhan}` });
  const sc = await scCreate(apiAdmin, { xe_id: xe.id, ngay: today() });
  scIds.push(sc.id);
  return sc.id;
}

async function vattuRow(id: string): Promise<{ ton: number; ton_cu_hong: number; gia: number }> {
  const r = await db.query('SELECT ton, ton_cu_hong, gia FROM vattu WHERE id = $1', [id]);
  return { ton: Number(r.rows[0].ton), ton_cu_hong: Number(r.rows[0].ton_cu_hong), gia: Number(r.rows[0].gia) };
}

async function ttOf(scId: string, vattuId: string): Promise<string> {
  const r = await db.query("SELECT tt FROM sc_vattu WHERE sc_id = $1 AND vattu_id = $2 AND deleted_at = ''", [scId, vattuId]);
  return r.rows[0].tt;
}

async function countNx(where: string, params: any[]): Promise<number> {
  const r = await db.query(`SELECT COUNT(*)::int AS c FROM nhap_xuat WHERE ${where}`, params);
  return r.rows[0].c;
}

afterAll(async () => {
  // Soft-delete toàn bộ fixture (quy tắc v5 — không DELETE cứng); theo id đã ghi
  // nhận nên không đụng dữ liệu suite khác chạy cùng shared DB.
  if (vtIds.length) {
    await db.query("UPDATE vattu SET deleted_at = $2 WHERE id = ANY($1::text[])", [vtIds, today()]);
    await db.query("UPDATE vattu_gia_lich_su SET deleted_at = $1 WHERE vattu_id = ANY($2::text[])", [today(), vtIds]);
    await db.query("UPDATE thanh_ly SET deleted_at = $1 WHERE vattu_id = ANY($2::text[])", [today(), vtIds]);
    await db.query("UPDATE nhap_xuat SET deleted_at = $1 WHERE vattu_id = ANY($2::text[])", [today(), vtIds]);
  }
  if (scIds.length) {
    for (const sc of scIds) {
      await db.query("UPDATE sc_vattu SET deleted_at = $1 WHERE sc_id = $2", [today(), sc]);
      await db.query("UPDATE nhap_xuat SET deleted_at = $1 WHERE sc_id = $2", [today(), sc]);
      await db.query("UPDATE thanh_ly SET deleted_at = $1 WHERE sc_id = $2", [today(), sc]);
      await db.query("UPDATE sc SET deleted_at = $1 WHERE id = $2", [today(), sc]);
    }
  }
});

jest.setTimeout(60000);

describe('W1c — kho hư hỏng cách ly + thanh lý (nhapKho/xuatKho loai cu_hong, tonKho, thanhLyList)', () => {
  test('TC1 — nhập cu_hong KHÔNG đổi ton/tonKho/giaLichSu; Guard ton_cu_hong khi xuất; thanh_ly 1 dòng; whitelist chặn', async () => {
    const vt = await mkVattu('CH1', 5000);
    // nhập thường 2 (ton=2) — nhánh W0 giữ nguyên hành vi
    await nhapKho(apiKho, { vattu_id: vt, so_luong: 2, don_gia: 5000, ngay: today(), ly_do: 'W1c thuong' });
    // nhập cu_hong 5 → ton_cu_hong=5, ton KHÔNG đổi, don_gia NULL, ly_do BỊ core ghi
    // buộc = marker (bảo toàn predicate loại trừ của autoXuatSC — custom ly_do bỏ qua)
    const pxn = await nhapKho(apiKho, { vattu_id: vt, so_luong: 5, ngay: today(), loai: 'cu_hong', ly_do: 'tùy biến bị bỏ qua' });
    let v = await vattuRow(vt);
    expect(v.ton).toBe(2);
    expect(v.ton_cu_hong).toBe(5);
    const dong = await db.query('SELECT * FROM nhap_xuat WHERE id = $1', [pxn.id]);
    expect(dong.rows[0].loai).toBe('nhap'); //schema CHECK 'nhap'|'xuat' giữ nguyên — subtype = ly_do marker
    expect(dong.rows[0].ly_do).toBe(THU_HOI_MARKER);
    expect(dong.rows[0].don_gia).toBeNull();
    //lịch sử giá: CHỈ mốc nhập thường (parity v3.6 dòng 379–380 — cu_hong không ghi giá)
    const gs = await db.query("SELECT COUNT(*)::int AS c FROM vattu_gia_lich_su WHERE vattu_id = $1 AND deleted_at = ''", [vt]);
    expect(gs.rows[0].c).toBe(1);

    //xuất cu_hong 3 guard ton_cu_hong: OK → 2; ton thường không đụng
    const pxx = await xuatKho(apiKho, { vattu_id: vt, so_luong: 3, loai_xuat: 'cu_hong', ly_do: 'Thanh lý', gia_thanh_ly: 10000, ngay: today() });
    v = await vattuRow(vt);
    expect(v.ton_cu_hong).toBe(2);
    expect(v.ton).toBe(2);
    const dongX = await db.query('SELECT * FROM nhap_xuat WHERE id = $1', [pxx.id]);
    expect(dongX.rows[0].loai).toBe('xuat');
    expect(dongX.rows[0].don_gia).toBeNull();

    //xuất cu_hong VƯỢT → báo đúng thông báo task + ROLLBACK sạch (ton_cu_hong giữ 2,
    //KHÔNG rơi dòng thanh_ly "ma" dù ly_do='Thanh lý' — tx bất biến)
    await expect(xuatKho(apiKho, { vattu_id: vt, so_luong: 5, loai_xuat: 'cu_hong', ly_do: 'Thanh lý' }))
      .rejects.toThrow(/^Không đủ tồn hư hỏng/);
    v = await vattuRow(vt);
    expect(v.ton_cu_hong).toBe(2);
    const tlCheck = await db.query("SELECT COUNT(*)::int AS c FROM thanh_ly WHERE vattu_id = $1 AND deleted_at = ''", [vt]);
    expect(tlCheck.rows[0].c).toBe(1);

    //Whitelist nhánh + số nguyên (cột ton_cu_hong INTEGER — chặn làm tròn thầm lặng):
    await expect(nhapKho(apiKho, { vattu_id: vt, so_luong: 1, ngay: today(), loai: 'Cu Hong' })).rejects.toThrow(/loai không hợp lệ/);
    await expect(xuatKho(apiKho, { vattu_id: vt, so_luong: 1, loai_xuat: 'hk' })).rejects.toThrow(/loai_xuat không hợp lệ/);
    await expect(nhapKho(apiKho, { vattu_id: vt, so_luong: 2.5, ngay: today(), loai: 'cu_hong' })).rejects.toThrow(/số nguyên dương/);
    await expect(xuatKho(apiKho, { vattu_id: vt, so_luong: 1.5, loai_xuat: 'cu_hong' })).rejects.toThrow(/số nguyên dương/);

    //guard W0 của xuất thường KHÔNG đổi hợp đồng lỗi (kho_race regex). Ton là
    //NUMERIC(12,2) → pg trả '2.00' (hành vi chuỗi số W0 vốn có).
    await expect(xuatKho(apiKho, { vattu_id: vt, so_luong: 3 })).rejects.toThrow(/^Thiếu tồn kho \(ton: 2(\.0+)?\)/);

    //tonKho expose ton_cu_hong như v3.6 dòng 87; giá trị tồn KHÔNG định giá kho hỏng
    const tk = await tonKho(apiKho, { page: 1, limit: 200 });
    const item = tk.result.items.find((x: any) => x.id === vt);
    expect(item.ton).toBe(2);
    expect(item.ton_cu_hong).toBe(2);
    expect(item.gia_tri).toBe(10000); //2 × 5000 — hỏng 2 cái không vào giá trị

    //thanhLyList JOIN vattu: đúng 1 dòng của vt, field số hóa
    const tl = await thanhLyList(apiKho, { sc_id: undefined, limit: 200 });
    expect(tl.ok).toBe(true);
    const rows = tl.result!.filter((r: any) => r.vattu_id === vt);
    expect(rows).toHaveLength(1);
    expect(rows[0].so_luong).toBe(3);
    expect(rows[0].gia_thanh_ly).toBe(10000);
    expect(rows[0].ly_do).toBe('Thanh lý');
    expect(rows[0].vattu_ten).toBe(`${MARK} CH1`);
    expect(rows[0].sc_id).toBeNull();
    expect(typeof tl.total).toBe('number');
  });

  test('TC1b — thanhLyList validate input theo convention hàm mới (ok:false, không throw)', async () => {
    for (const bad of [{ from: '2026/01/02' }, { to: 'abc' }, { limit: 0 }, { limit: 201 }, { limit: 2.5 }, { limit: 'x' }, { offset: -1 }, { sc_id: 123 }]) {
      const r = await thanhLyList(apiKho, bad as any);
      expect({ arg: bad, ok: r.ok }).toEqual({ arg: bad, ok: false });
    }
    const rRange = await thanhLyList(apiKho, { from: '2000-01-01', to: '2099-12-31' });
    expect(rRange.ok).toBe(true);
    const noArgs = await thanhLyList(apiKho);
    expect(noArgs.ok).toBe(true);
  });

  test('TC2 — autoXuatSC: thiếu→chờ, đủ→ĐÚNG 1 phiếu nhóm (idempotent 2 lần gọi), ton giảm đúng 10', async () => {
    const vt = await mkVattu('XS2', null);
    const scA = await mkSc('A');
    await scAddVatTu(apiAdmin, { sc_id: scA, vattu_id: vt, so_luong: 10 }); //sc de_xuat — autoXuatSC không gate trạng thái (parity v3.6)
    expect(await ttOf(scA, vt)).toBe('can_mua');

    //thiếu: nhập 6 vào SC (nhập thường → da_mua) — autoXuatSC phải chờ, KHÔNG phiếu
    await nhapKho(apiKho, { vattu_id: vt, so_luong: 6, don_gia: 90, ngay: today(), sc_id: scA });
    expect(await ttOf(scA, vt)).toBe('da_mua'); //v3.6 dòng 383
    const r1 = await autoXuatSC(apiKho, { sc_id: scA });
    expect(r1).toEqual({ ok: true, phieu_id: null });
    expect(await countNx("sc_id = $1 AND loai = 'xuat' AND deleted_at = ''", [scA])).toBe(0);
    expect((await vattuRow(vt)).ton).toBe(6);

    //đủ 6+4=10 → tạo đúng 1 dòng xuất nhóm; đơn giá = MAX giá nhập SC (90 — v3.6 gia_ngay)
    await nhapKho(apiKho, { vattu_id: vt, so_luong: 4, don_gia: 80, ngay: today(), sc_id: scA });
    const r2 = await autoXuatSC(apiKho, { sc_id: scA });
    expect(r2.ok).toBe(true);
    expect(String(r2.phieu_id)).toMatch(/^NX-\d{6}$/);
    expect(await countNx("sc_id = $1 AND loai = 'xuat' AND deleted_at = ''", [scA])).toBe(1);
    const pxx = await db.query("SELECT * FROM nhap_xuat WHERE sc_id = $1 AND loai = 'xuat' AND deleted_at = ''", [scA]);
    expect(Number(pxx.rows[0].so_luong)).toBe(10);
    expect(Number(pxx.rows[0].don_gia)).toBe(90);
    expect(pxx.rows[0].ly_do).toBe('Xuất tự động khi nhập đủ vật tư (liên thông)');
    expect(pxx.rows[0].phieu_id).toBe(pxx.rows[0].id); //nhóm 1 dòng: eff tự tham chiếu (W1a)
    expect((await vattuRow(vt)).ton).toBe(0);
    expect(await ttOf(scA, vt)).toBe('da_xuat');
    //audit ghi cùng tx (Chuan 3):
    const audit = await db.query("SELECT COUNT(*)::int AS c FROM activity_log WHERE sc_id = $1 AND hanh_dong = 'kho_xuat' AND mo_ta LIKE 'Xuất tự động%'", [scA]);
    expect(audit.rows[0].c).toBe(1);

    //IDEMPOTENT: gọi thêm 2 lần → không phiếu mới, không trừ lần hai
    const r3 = await autoXuatSC(apiKho, { sc_id: scA });
    const r4 = await autoXuatSC(apiKho, { sc_id: scA });
    expect([r3.phieu_id, r4.phieu_id]).toEqual([null, null]);
    expect(await countNx("sc_id = $1 AND loai = 'xuat' AND deleted_at = ''", [scA])).toBe(1);
    expect((await vattuRow(vt)).ton).toBe(0);
  });

  test('TC2b — xuatKho thường kèm sc_id đánh dấu da_xuat → autoXuatSC không xuất trùng cầu', async () => {
    const vt = await mkVattu('XS-B', null);
    const scB = await mkSc('B');
    await scAddVatTu(apiAdmin, { sc_id: scB, vattu_id: vt, so_luong: 10 });
    await nhapKho(apiKho, { vattu_id: vt, so_luong: 20, ngay: today() }); //không link SC → tt giữ can_mua
    expect(await ttOf(scB, vt)).toBe('can_mua');
    //xuất tay 12 gán trực tiếp vào SC (v3.6 phXuatCreate ref_sc → da_xuat dòng 448)
    const px = await xuatKho(apiKho, { vattu_id: vt, so_luong: 12, sc_id: scB, ly_do: 'lắp tay W1c', ngay: today() });
    expect((await vattuRow(vt)).ton).toBe(8);
    expect(await ttOf(scB, vt)).toBe('da_xuat');
    const auto = await autoXuatSC(apiKho, { sc_id: scB });
    expect({ ok: auto.ok, pid: auto.phieu_id === null ? 'null' : 'id' }).toEqual({ ok: true, pid: 'null' });
    //chỉ dòng xuất TAY tồn tại (không phát sinh phiếu auto lần hai)
    const c = await db.query("SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE id <> $2)::int AS auto_c FROM nhap_xuat WHERE sc_id = $1 AND loai = 'xuat' AND deleted_at = ''", [scB, px.id]);
    expect(c.rows[0].c).toBe(1);
    expect(c.rows[0].auto_c).toBe(0);
  });
});

describe('W1c — autoGenCuHong (thu hồi VT thay thế + chống trùng + tách khỏi đếm nhập)', () => {
  test('TC3 — gate trạng thái; tạo PXN marker + ton_cu_hong tăng + thanh_ly; gọi 2 KHÔNG trùng; nhập cu_hong KHÔNG tính đủ cầu', async () => {
    const vt = await mkVattu('GH3', null);
    const scC = await mkSc('C');
    await scAddVatTu(apiAdmin, { sc_id: scC, vattu_id: vt, so_luong: 3 });
    //W3 (sc.ts) mới đổ loai_xu_ly từ UI công việc → fixture set trực tiếp cột W1c.
    await db.query("UPDATE sc_vattu SET loai_xu_ly = 'thay_the' WHERE sc_id = $1 AND vattu_id = $2", [scC, vt]);

    //gate 1: SC de_xuat → từ chối (v3.6: chỉ dang_sua/hoàn — v5 thêm da_quyet theo chốt)
    const g0 = await autoGenCuHong(apiKho, { sc_id: scC });
    expect({ ok: g0.ok, e: g0.error }).toMatchObject({ ok: false, e: expect.stringMatching(/Chỉ tạo VT cũ\/hỏng/) });
    await scBatDauSua(apiAdmin, { sc_id: scC }); //→ dang_sua

    //gate 2: không có VT thay thế
    await db.query("UPDATE sc_vattu SET loai_xu_ly = '' WHERE sc_id = $1", [scC]);
    const gE = await autoGenCuHong(apiKho, { sc_id: scC });
    expect(gE.error).toMatch(/không có vật tư loại thay thế/);
    await db.query("UPDATE sc_vattu SET loai_xu_ly = 'Thay_The ' WHERE sc_id = $1", [scC]); //thường-hóa hoa/xoay — W3 có thể ghi kiểu khác

    //lần 1: tạo phiếu thu hồi
    const b4 = await vattuRow(vt);
    const g1 = await autoGenCuHong(apiKho, { sc_id: scC });
    expect(g1.ok).toBe(true);
    expect(String(g1.id)).toMatch(/^NX-\d{6}$/);
    expect(g1.so_dong).toBe(1);
    const af = await vattuRow(vt);
    expect(af.ton).toBe(b4.ton);
    expect(af.ton_cu_hong).toBe(3); //v3.6 dòng 506: ton_cu_hong += so_luong
    const phieu = await db.query('SELECT * FROM nhap_xuat WHERE id = $1', [g1.id!]);
    expect(phieu.rows[0].loai).toBe('nhap');
    expect(phieu.rows[0].ly_do).toBe(THU_HOI_MARKER);
    expect(phieu.rows[0].ncc).toBe(THU_HOI_MARKER); //'Thu hồi nội bộ' (v3.6 nha_cc dòng 498)
    expect(phieu.rows[0].sc_id).toBe(scC);
    const tl = await db.query("SELECT * FROM thanh_ly WHERE sc_id = $1 AND deleted_at = ''", [scC]);
    expect(tl.rows).toHaveLength(1);
    expect(Number(tl.rows[0].so_luong)).toBe(3);
    expect(tl.rows[0].ly_do).toBe(`Thay thế — tự động từ SC ${scC}`);
    const audit = await db.query("SELECT COUNT(*)::int AS c FROM activity_log WHERE sc_id = $1 AND hanh_dong = 'kho_nhap' AND mo_ta LIKE 'Tự động nhập VT cũ/hỏng%'", [scC]);
    expect(audit.rows[0].c).toBe(1);

    //chống trùng: gọi lần 2 — KHÔNG phiếu mới, KHÔNG tăng ton_cu_hong hai lần
    const g2 = await autoGenCuHong(apiKho, { sc_id: scC });
    expect({ ok: g2.ok, e: g2.error }).toMatchObject({ ok: false, e: expect.stringMatching(/đã tạo nhập VT cũ\/hỏng rồi/) });
    expect((await vattuRow(vt)).ton_cu_hong).toBe(3);
    expect(await countNx('sc_id = $1 AND deleted_at = \'\'', [scC])).toBe(1);

    //PHÂN BIỆT v3.6 (Production Check): phiếu thu hồi KHÔNG được tính "đã nhập"
    //cho autoXuatSC — cầu 3 chưa có hàng tốt → chờ, ton_cu_hong 3 không trừ thành âm.
    const auto = await autoXuatSC(apiKho, { sc_id: scC });
    expect({ ok: auto.ok, pid: auto.phieu_id === null ? 'null' : 'id' }).toEqual({ ok: true, pid: 'null' });
    expect((await vattuRow(vt)).ton_cu_hong).toBe(3);
    expect((await vattuRow(vt)).ton).toBe(0);
    expect(await countNx("sc_id = $1 AND loai = 'xuat' AND deleted_at = ''", [scC])).toBe(0);

    //nhập thường giờ mới đủ cầu → 1 phiếu auto OK (link nhập↔cầu chạy đúng với sc_id)
    await nhapKho(apiKho, { vattu_id: vt, so_luong: 3, don_gia: 111, ngay: today(), sc_id: scC });
    const auto2 = await autoXuatSC(apiKho, { sc_id: scC });
    expect(String(auto2.phieu_id)).toMatch(/^NX-\d{6}$/);
    expect((await vattuRow(vt)).ton).toBe(0);
    expect(await ttOf(scC, vt)).toBe('da_xuat');

    //gate 3: SC đã hoàn thành vẫn cho phép thu hồi; VT MỚI phát sinh thì tạo tiếp
    //(chống trùng theo CẶP sc/vattu — trội hơn v3.6 chặn cả SC)
    await scHoanThanh(apiAdmin, { sc_id: scC }); //dang_sua→da_hoan
    const vt2 = await mkVattu('GH3-B', null);
    await scAddVatTu(apiAdmin, { sc_id: scC, vattu_id: vt2, so_luong: 2 });
    await db.query("UPDATE sc_vattu SET loai_xu_ly = 'thay_moi' WHERE sc_id = $1 AND vattu_id = $2", [scC, vt2]);
    const g3 = await autoGenCuHong(apiKho, { sc_id: scC });
    expect({ ok: g3.ok, so: g3.so_dong }).toEqual({ ok: true, so: 1 });
    expect((await vattuRow(vt2)).ton_cu_hong).toBe(2);
  });

  test('TC3b — autoGen/autoXuat validate input + 404 SC', async () => {
    await expect(autoGenCuHong(apiKho, {})).resolves.toMatchObject({ ok: false, error: 'Thiếu sc_id' });
    await expect(autoXuatSC(apiKho, { sc_id: '   ' })).resolves.toMatchObject({ ok: false });
    const g = await autoGenCuHong(apiKho, { sc_id: 'SC-999999' });
    expect({ ok: g.ok, e: g.error }).toEqual({ ok: false, e: 'Không tìm thấy phiếu sửa chữa.' });
    const a = await autoXuatSC(apiKho, { sc_id: 'SC-999999' });
    expect(a.ok).toBe(false);
  });
});
