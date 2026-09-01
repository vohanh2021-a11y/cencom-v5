/**
 * W1b — TỒN KHO + LỊCH SỬ GIÁ (lib/core/kho.ts: tonKho/giaLichSuList/ghiGiaLichSu
 * + hook nhapKho/dmNhap). Port hành vi v3.6 kho.js dòng 79–94 (tonKho),
 * 259–266 (ghiGiaLichSu), 268–277 (giaLichSuList) trên bảng v5 `vattu_gia_lich_su`.
 *
 * tonKho/giaLichSuList CHƯA đăng ký RPC (lib/rpc.ts thuộc worker-c — meta
 * ['kho','xem'] dành cho W1b-reg/W1.6f) → test GOI HAM CORE TRUC TIEP qua
 * buildApi(actorKho) + db, pattern kế thừa asset_gttv.test.ts (không HTTP).
 * Riêng nhapKho/dmNhap/dmCreate gọi thẳng core như bản HTTP dispatch sẽ gọi.
 * W2c: dmNhap siết guard 'da_duyet' (port v3.6) → TC6 lật trạng thái DM bằng
 * SQL tối thiểu TRƯỚC khi nhập (quyền duyệt test riêng ở dm_decide.test.ts (7)).
 *
 * Fixture tạo bằng role 'kho' → is_test=0 (quy tắc isTest của kho.ts: chỉ admin
 * gắn 1) — tonKho lọc is_test=0 NÊN fixture bắt buộc is_test=0; phân tách khỏi seed
 * bằng MARK + asserts THEO CHÊNH SỐ baseline (không tuyệt đối hóa — an toàn khi
 * chạy cùng suite kho_race/kho_phieu2tang trong một lệnh jest).
 */
import { buildApi } from '../../lib/api';
import { db } from '../../lib/db';
import {
  vattuCreate, nhapKho, dmCreate, dmNhap, tonKho, giaLichSuList,
} from '../../lib/core/kho';

const apiKho = buildApi({ id: 'U-KHO', name: 'kho', role: 'kho' });

const today = () => new Date().toISOString().split('T')[0];
const MARK = 'W1bVT';

/** So sánh tiền dung sai ±1 (NUMERIC→float8 làm tròn) — fail kèm nhãn đọc được */
function near(actual: number, expected: number, label = 'near'): void {
  const a = Number(actual);
  if (!Number.isFinite(a) || Math.abs(a - expected) > 1) {
    throw new Error(`${label}: |${actual} − ${expected}| = ${Math.abs(a - expected)} > 1`);
  }
}

/** Lịch sử giá đang sống của một vật tư, theo chèn (id ASC) */
async function logsOf(vattuId: string): Promise<any[]> {
  const r = await db.query(
    "SELECT * FROM vattu_gia_lich_su WHERE vattu_id = $1 AND deleted_at = '' ORDER BY id ASC",
    [vattuId]
  );
  return r.rows;
}

/** Aggregate TOÀN BỘ vattu active is_test=0 — cùng công thức tonKho dùng (độc lập core) */
async function baselineAgg(): Promise<{ total: number; low: number; giaTri: number }> {
  const r = await db.query(
    "SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE ton < ton_min)::int low, " +
      "COALESCE(SUM(gia * ton), 0)::float8 gia_tri FROM vattu WHERE deleted_at = '' AND is_test = 0"
  );
  const x = r.rows[0];
  return { total: x.total, low: x.low, giaTri: Number(x.gia_tri) };
}

const createdVt: string[] = [];

async function mkVattu(ten: string, tonMin: number, gia: number | null): Promise<string> {
  const r = await vattuCreate(apiKho, { ten: `${MARK} ${ten}`, don_vi: 'cái', gia: gia ?? undefined, ton_min: tonMin });
  createdVt.push(r.id);
  return r.id;
}

afterAll(async () => {
  //Soft-delete fixture theo chuẩn v5 (không DELETE cứng); dòng lịch sử giá soft-delete theo vattu
  if (createdVt.length) {
    await db.query("UPDATE vattu SET deleted_at = $1 WHERE id = ANY($2::text[])", [today(), createdVt]);
    await db.query("UPDATE vattu_gia_lich_su SET deleted_at = $1 WHERE vattu_id = ANY($2::text[])", [today(), createdVt]);
  }
});

jest.setTimeout(60000);

describe('W1b — tonKho + vattu_gia_lich_su + ghiGiaLichSu + giaLichSuList (core trực tiếp)', () => {
  let vtA: string; // vật tư xuyên suốt TC1–TC4 (nhập kho → lịch sử 'nhap')
  const dmNgay = today();

  /* ── TC1: nhapKho có don_gia>0 → ghi 1 dòng loai='nhap', đúng phieu/ngay ── */
  test('TC1 — nhapKho don_gia>0 ghi mốc giá trong cùng tx (loai=nhap, phieu_id=NX, ngay=args.ngay)', async () => {
    vtA = await mkVattu('A', 10, null);
    const nx = await nhapKho(apiKho, { vattu_id: vtA, so_luong: 4, don_gia: 100, ngay: dmNgay, ly_do: 'W1b TC1' });
    const logs = await logsOf(vtA);
    expect(logs).toHaveLength(1);
    expect(Number(logs[0].gia)).toBe(100);
    expect(logs[0].loai).toBe('nhap');
    expect(logs[0].phieu_id).toBe(nx.id);
    expect(logs[0].ngay).toBe(dmNgay);
    expect(logs[0].created_by).toBe('U-KHO');
    expect(Number(logs[0].is_test)).toBe(0); // role kho → fixture is_test=0
  });

  /* ── TC2: don_gia thiếu / 0 → KHÔNG ghi lịch sử (v3.6 dòng 260) ── */
  test('TC2 — nhapKho không don_gia hoặc don_gia=0 → không phát sinh dòng lịch sử', async () => {
    const before = (await logsOf(vtA)).length;
    await nhapKho(apiKho, { vattu_id: vtA, so_luong: 1, ngay: dmNgay, ly_do: 'W1b TC2 khong gia' });
    await nhapKho(apiKho, { vattu_id: vtA, so_luong: 1, don_gia: 0, ngay: dmNgay, ly_do: 'W1b TC2 gia 0' });
    //don_gia ÂM: core cũ không chặn ở optionalNumber (hành vi v3.6 giữ nguyên) →
    //vẫn tạo phiếu, nhưng ghiGiaLichSu tự skip vì g<=0. (TC3 chạy sau sẽ ghi đè
    //gia = 200 qua COALESCE → không để lại rac cho các TC dung sai gia tri.)
    await nhapKho(apiKho, { vattu_id: vtA, so_luong: 1, don_gia: -50, ngay: dmNgay, ly_do: 'W1b TC2 gia am' });
    expect(await logsOf(vtA)).toHaveLength(before);
  });

  /* ── TC3: dedupe liên tiếp (vattu,gia,ngay) + giá mới vẫn ghi ── */
  test('TC3 — nhập lại CÙNG (gia,ngay) liên tiếp → skip; khác giá → ghi mốc mới', async () => {
    await nhapKho(apiKho, { vattu_id: vtA, so_luong: 1, don_gia: 100, ngay: dmNgay, ly_do: 'W1b TC3 trung' });
    expect(await logsOf(vtA)).toHaveLength(1); // (100,hom nay) == dòng cuối → dedupe
    await nhapKho(apiKho, { vattu_id: vtA, so_luong: 1, don_gia: 200, ngay: dmNgay, ly_do: 'W1b TC3 gia moi' });
    const logs = await logsOf(vtA);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => Number(l.gia))).toEqual([100, 200]);
    //ton sau TC1–TC3: 4 + 3 lần TC2(1) + 2 lần TC3 = 4+3+2 = 9 — guard bằng SELECT
    const ton = await db.query('SELECT ton, gia FROM vattu WHERE id = $1', [vtA]);
    expect(Number(ton.rows[0].ton)).toBe(9);
    expect(Number(ton.rows[0].gia)).toBe(200); // COALESCE giá mới nhất (hành vi cũ giữ nguyên)
  });

  /* ── TC4: giaLichSuList — top 8 mặc định + DESC + limit + validate ── */
  test('TC4 — giaLichSuList default 8 mốc ngay DESC/id DESC; limit 1..30; input sai → ok:false', async () => {
    const vtB = await mkVattu('B', 1, null);
    //10 mốc giá TĂNG DẦN cùng ngày → không dính dedupe; id chèn tăng dần theo call
    for (let i = 1; i <= 10; i++) {
      await nhapKho(apiKho, { vattu_id: vtB, so_luong: 1, don_gia: i * 10, ngay: dmNgay, ly_do: `W1b TC4 g${i}` });
    }
    const def = await giaLichSuList(apiKho, { vattu_id: vtB });
    expect(def.ok).toBe(true);
    expect(def.result).toHaveLength(8); // LIMIT mặc định 8, không phải 10
    //ngay DESC, id DESC → 10 mốc cùng ngày ⇒ id mới nhất trước ⇒ giá giảm dần 100..30
    expect(def.result!.map((x: any) => x.gia)).toEqual([100, 90, 80, 70, 60, 50, 40, 30]);
    expect(def.result!.every((x: any) => x.vattu_id === vtB && x.loai === 'nhap' && x.ngay === dmNgay)).toBe(true);
    //field contract: đúng bộ cột, gia là number
    expect(Object.keys(def.result![0]).sort()).toEqual(['gia', 'id', 'loai', 'ncc', 'ngay', 'phieu_id', 'vattu_id']);

    const top3 = await giaLichSuList(apiKho, { vattu_id: vtB, limit: 3 });
    expect(top3.result!.map((x: any) => x.gia)).toEqual([100, 90, 80]);

    //vật tư chưa có mốc giá → mảng rỗng hợp lệ
    const vtEmpty = await mkVattu('EMPTY', 0, null);
    const rEmpty = await giaLichSuList(apiKho, { vattu_id: vtEmpty });
    expect({ ok: rEmpty.ok, n: rEmpty.result!.length }).toEqual({ ok: true, n: 0 });

    //validate: vattu_id str 1..12; limit int 1..30 (max 30 — spec W1b, khác v3.6 LIMIT 200)
    for (const bad of [undefined, '', 123, 'X'.repeat(13), {}]) {
      const r = await giaLichSuList(apiKho, { vattu_id: bad as any });
      expect(r.ok).toBe(false);
    }
    for (const badLimit of [0, -1, 31, 2.5, 'abc']) {
      const r = await giaLichSuList(apiKho, { vattu_id: vtB, limit: badLimit as any });
      expect(r.ok).toBe(false);
    }
    //KHÔNG BAO GIỜ throw ra ngoài
    const none = await giaLichSuList(apiKho, undefined as any);
    expect(none.ok).toBe(false);
  });

  /* ── TC5: tonKho — low/thieu/sort/total/giaTriTonKho/lowCount + phân trang + validate ── */
  test('TC5 — tonKho: low flag đúng (ton<ton_min), ORDER thieu ASC, total + giaTriTonKho theo SQL toàn bộ', async () => {
    //Baseline SAU khi các fixture trước đã tồn tại → mọi assert là CHÊNH số cục bộ
    const base = await baselineAgg();
    // VT-LOW: ton_min=10, ton=4      → low, thieu=−6,  gia_tri=4·100=400
    const vtLow = await mkVattu('LOW', 10, null);
    await nhapKho(apiKho, { vattu_id: vtLow, so_luong: 4, don_gia: 100, ngay: dmNgay });
    // VT-OK:  ton_min=1,  ton=500     → hết hạn, thieu=499, gia_tri=500·2=1000
    const vtOk = await mkVattu('OK500', 1, null);
    await nhapKho(apiKho, { vattu_id: vtOk, so_luong: 500, don_gia: 2, ngay: dmNgay });

    const res = await tonKho(apiKho, {});
    expect(res.ok).toBe(true);
    const { items, total, page, limit, giaTriTonKho, lowCount } = res.result;
    expect(page).toBe(1);
    expect(limit).toBe(50);
    const a = items.find((x: any) => x.id === vtLow);
    const b = items.find((x: any) => x.id === vtOk);
    expect(a).toBeDefined(); expect(b).toBeDefined();
    expect(a.low).toBe(true);
    expect(a.ton).toBe(4); expect(a.ton_min).toBe(10); expect(a.thieu).toBe(-6);
    expect(a.gia).toBe(100); expect(a.gia_tri).toBe(400);
    expect(b.low).toBe(false);
    expect(b.ton).toBe(500); expect(b.thieu).toBe(499); expect(b.gia_tri).toBe(1000);
    //chênh số bất biến theo tập đang chọn — giaTriTonKho là SUM SQL (400+1000 mới thêm)
    expect(total).toBe(base.total + 2);
    expect(lowCount).toBe(base.low + 1);
    near(giaTriTonKho, base.giaTri + 400 + 1000, 'giaTriTonKho delta');
    //SẮP THẲNG: thieu KHÔNG GIẢM dần trên cả trang (thiếu nặng đầu bảng) + LOW đứng trước OK
    for (let k = 1; k < items.length; k++) expect(items[k].thieu).toBeGreaterThanOrEqual(items[k - 1].thieu);
    expect(items.findIndex((x: any) => x.id === vtLow)).toBeLessThan(items.findIndex((x: any) => x.id === vtOk));

    //low_only: chỉ dòng thiếu — total bám lowCount, không đổi mọi page
    const onlyLow = await tonKho(apiKho, { low_only: true });
    expect(onlyLow.result.items.every((x: any) => x.low === true)).toBe(true);
    expect(onlyLow.result.items.some((x: any) => x.id === vtLow)).toBe(true);
    expect(onlyLow.result.items.some((x: any) => x.id === vtOk)).toBe(false);
    expect(onlyLow.result.total).toBe(lowCount);
    //giaTriTonKho/lowCount KHÔNG đổi theo low_only (đọc toàn bộ — 1 subquery)
    expect(onlyLow.result.lowCount).toBe(lowCount);
    near(onlyLow.result.giaTriTonKho, giaTriTonKho, 'giaTri khi low_only');

    //phân trang: mỗi trang 1 dòng, không trùng, page/limit echo, total giữ nguyên
    const p1 = await tonKho(apiKho, { page: 1, limit: 1 });
    const p2 = await tonKho(apiKho, { page: 2, limit: 1 });
    expect(p1.result.items).toHaveLength(1);
    expect(p2.result.items).toHaveLength(1);
    expect(p1.result.items[0].id).not.toBe(p2.result.items[0].id);
    expect(p1.result.total).toBe(total); expect(p2.result.total).toBe(total);
    expect([p1.result.page, p1.result.limit, p2.result.page, p2.result.limit]).toEqual([1, 1, 2, 1]);
    //trang vượt dữ liệu → items rỗng nhưng aggregate vẫn đúng (không nổ)
    const pOut = await tonKho(apiKho, { page: total + 5, limit: 50 });
    expect(pOut.result.items).toHaveLength(0);
    expect(pOut.result.total).toBe(total);

    //validate (hàm mới KHÔNG throw — trả {ok:false})
    for (const bad of [{ page: 0 }, { page: 1.5 }, { page: 'abc' }, { limit: 201 }, { limit: 0 }, { limit: 'x' }, { low_only: 'yes' }]) {
      const r = await tonKho(apiKho, bad);
      expect({ arg: bad, ok: r.ok }).toEqual({ arg: bad, ok: false });
    }
    const rNoArgs = await tonKho(apiKho, undefined as any); // nullish → default, không nổ
    expect(rNoArgs.ok).toBe(true);
  });

  /* ── TC6: dmNhap → ghi mốc loai='dm', ngay=ngay DM, phieu_id = eff nhóm ── */
  test('TC6 — dmNhap items don_gia>0 ghi loai=dm/đúng ngay DM; don_gia=0 không ghi', async () => {
    const vtE = await mkVattu('E-dm', 0, null);
    const vtE0 = await mkVattu('E0-dm', 0, null);
    const dm = await dmCreate(apiKho, {
      ngay: dmNgay,
      items: [
        { vattu_id: vtE, so_luong: 2, don_gia: 50 },   // có giá → ghi 'dm'
        { vattu_id: vtE0, so_luong: 1, don_gia: 0 },    // giá 0 → bỏ
      ],
    });
    //W2c: dmNhap CHỈ nhận DM 'da_duyet' (guard v3.6 trong core) → lật trạng thái
    //bằng SQL thẳng, TỐI THIỂU: quyền duyệt (dmDecide ngươn-giám-ngã) đã được
    //test riêng ở dm_decide.test.ts (7); ở đây nghiệm ý đồ "nhập DM ghi mốc giá".
    await db.query("UPDATE dm SET trang_thai = 'da_duyet' WHERE id = $1", [dm.id]);
    const nhap = await dmNhap(apiKho, { dm_id: dm.id });
    expect(nhap.ok).toBe(true); // nếu guard đổi hành vi → fail ngay tại đây, không âm thầm

    const logsE = await logsOf(vtE);
    expect(logsE).toHaveLength(1);
    expect(logsE[0].loai).toBe('dm');
    expect(Number(logsE[0].gia)).toBe(50);
    expect(logsE[0].ngay).toBe(dmNgay); // ngay = ngay_tao của DM (không phải today() cứng)
    //phieu_id = eff W1a = id dòng ĐẦU nhóm phiếu nhập DM
    const phieu = await db.query(
      "SELECT id FROM nhap_xuat WHERE ly_do = $1 AND deleted_at = '' ORDER BY id LIMIT 1",
      [`Nhập DM ${dm.id}`]
    );
    expect(logsE[0].phieu_id).toBe(phieu.rows[0].id);
    expect(logsE[0].created_by).toBe('U-KHO');
    //dòng giá 0: không có mốc nào
    expect(await logsOf(vtE0)).toHaveLength(0);
    //dedupe dm: dmNhap lại dm cũ KHÔNG được (tras trang thai) — thay bằng nhập kho giá 50
    //cùng ngày vào vtE: giá khớp nhưng dòng cuối đã là (50,dmNgay) → skip.
    await nhapKho(apiKho, { vattu_id: vtE, so_luong: 1, don_gia: 50, ngay: dmNgay });
    expect(await logsOf(vtE)).toHaveLength(1);
  });

  /* ── TC7: bảng lịch sử đúng ràng buộc — gia NOT NULL, cột đủ theo schema ── */
  test('TC7 — INSERT trực tiếp bị chặn khi thiếu gia (NOT NULL) — cột đúng spec v5', async () => {
    await expect(db.query("INSERT INTO vattu_gia_lich_su (vattu_id, ngay) VALUES ($1, $2)", [vtA, dmNgay]))
      .rejects.toThrow(/not-null|violates/i);
    const cols = await db.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vattu_gia_lich_su'`
    );
    expect(cols.rows.map((c: any) => c.column_name).sort()).toEqual(
      ['created_by', 'deleted_at', 'gia', 'id', 'is_test', 'loai', 'ncc', 'ngay', 'phieu_id', 'vattu_id']
    );
  });
});
