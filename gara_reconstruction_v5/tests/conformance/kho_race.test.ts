/**
 * kho_race.test.ts — W0.1 RACE CONDITION TỒN KHO (PLAN_HOI_TU_01.09, Wave 0)
 *
 * Chứng minh bản fix transaction + row-guard trong lib/core/kho.ts:
 *  1) 10× xuatKho song song sl=6 trên vattu ton=40 → đúng 6 thành công / 4 lỗi
 *     "Thiếu tồn kho (ton: ...)", ton cuối = 4, phiếu xuất commit đúng 6 (rolls
 *     đã rollback không lọt xuống nhap_xuat).
 *  2) 10× nhapKho song song sl=1 → ton cuối = 14, không hụt (không lost update).
 *  3) dmNhap (3 items, +6) chạy SONG SONG với 1 xuatKho sl=12 trên cùng vattu
 *     ton=10 → bất kể thứ tự commit, KHÔNG BAO GIỜ âm tồn và bất biến
 *     ton_final = 10 + 6 − (12 nếu xuất thành công) nghiệm đúng.
 *
 * Gọi qua HTTP /api/rpc (same server + same pool như production → mới tạo được
 * độ tranh chấp thật). Pattern cookie kế thừa business.test.ts.
 */
import request from 'supertest';
import { getAdminToken, getKhoToken } from './setup';
import { db } from '../../lib/db';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

const today = () => new Date().toISOString().split('T')[0];

/** Đọc trực tiếp ton từ DB (bỏ qua cache/HTTP) — NUMERIC về dạng string → Number() */
async function getTon(vattuId: string): Promise<number> {
  const r = await db.query('SELECT ton FROM vattu WHERE id = $1', [vattuId]);
  return Number(r.rows[0]?.ton);
}

/** Số phiếu đã COMMIT của một loại trên vattu (kiểm tra atomicity rollback) */
async function countPhieu(loai: 'nhap' | 'xuat', vattuId: string): Promise<number> {
  const r = await db.query(
    "SELECT COUNT(*)::int AS c FROM nhap_xuat WHERE vattu_id = $1 AND loai = $2 AND deleted_at = ''",
    [vattuId, loai]
  );
  return r.rows[0].c;
}

/** Tạo vattu is_test (admin → is_test=1, không lẫn vào vattuList sản xuất) và nạp tồn đầu */
async function createVattuVoiTon(ten: string, ton: number): Promise<string> {
  const createRes = await rpc(getAdminToken(), 'vattuCreate', { ten, don_vi: 'cái', gia: 1000, ton_min: 1 });
  expect(createRes.body.ok).toBe(true);
  expect(createRes.body.result.id).toMatch(/^VT-\d{6}$/);
  const vtId: string = createRes.body.result.id;
  if (ton > 0) {
    const nhapRes = await rpc(getKhoToken(), 'nhapKho', {
      vattu_id: vtId, so_luong: ton, ngay: today(), ly_do: 'seed race test',
    });
    expect(nhapRes.body.ok).toBe(true);
    expect(await getTon(vtId)).toBe(ton);
  }
  return vtId;
}

jest.setTimeout(60000);

describe('W0.1 Race condition tồn kho — xuatKho/nhapKho/dmNhap atomic', () => {
  let vtId: string;

  beforeAll(async () => {
    //vattu is_test ton=40 — 40/6 = 6 lệnh xuất hợp lệ, 4 lệnh còn lại PHẢI bị chặn
    vtId = await createVattuVoiTon('W0.1 Race VT', 40);
  });

  test('10 xuatKho song song sl=6 (ton=40) → đúng 6 ok / 4 "Thiếu tồn kho", ton cuối = 4', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        rpc(getKhoToken(), 'xuatKho', { vattu_id: vtId, so_luong: 6, ly_do: `race-${i}` })
      )
    );
    const ok = results.filter((r) => r.body.ok === true);
    const fail = results.filter((r) => r.body.ok !== true);

    // Tổng QUÁT hóa lost update: nếu còn check-then-act TOCTOU, >6 lệnh sẽ cùng
    // "nhìn thấy" ton>=6 → ton âm. Row-guard biến điều đó thành BẤT BIẾN DB.
    expect(ok).toHaveLength(6);
    expect(fail).toHaveLength(4);

    // Hợp đồng {ok,result} giữ nguyên: thành công → result.id phiếu NX-??????
    for (const r of ok) expect(String(r.body.result.id)).toMatch(/^NX-\d{6}$/);

    // Hợp đồng lỗi: {ok:false, error:"Thiếu tồn kho (ton: ...)"} + status 400 (route map)
    for (const r of fail) {
      expect(r.status).toBe(400);
      expect(String(r.body.error)).toMatch(/^Thiếu tồn kho \(ton: \d/);
    }

    // ton cuối = 40 − 6×6 = 4, và đúng 6 phiếu xuất TỒN TẠI (36 dòng rollback không lọt)
    expect(await getTon(vtId)).toBe(4);
    expect(await countPhieu('xuat', vtId)).toBe(6);
  });

  test('10 nhapKho song song sl=1 (ton=4) → ton cuối = 14, không hụt', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        rpc(getKhoToken(), 'nhapKho', { vattu_id: vtId, so_luong: 1, ngay: today(), ly_do: `race-nhap-${i}` })
      )
    );
    for (const r of results) expect(r.body.ok).toBe(true);
    expect(await getTon(vtId)).toBe(14); // 4 + 10×1 — không mất phiếu nào
    expect(await countPhieu('nhap', vtId)).toBe(11); // 1 seed + 10 race
  });

  test('dmNhap 3 items song song với xuatKho sl=12 trên cùng vattu (ton=10) → không âm tồn', async () => {
    // vattu RIÊNG ton=10; dm 3 dòng × 2 = +6; xuất 12:
    //  - xuất chạy TRƯỚC khi dm commit → guard chặn (10<12) → ton cuối = 16
    //  - dm commit trước → xuất thắng (16≥12)  → ton cuối = 4
    // Cả hai nhánh đều không thể âm; bất biến bên dưới nghiệm đúng MỌI lịch trình.
    const vt2 = await createVattuVoiTon('W0.1 Race VT DM', 10);
    const dmRes = await rpc(getKhoToken(), 'dmCreate', {
      ngay: today(),
      items: [
        { vattu_id: vt2, so_luong: 2, don_gia: 1000 },
        { vattu_id: vt2, so_luong: 2, don_gia: 1000 },
        { vattu_id: vt2, so_luong: 2, don_gia: 1000 },
      ],
    });
    expect(dmRes.body.ok).toBe(true);
    const dmId: string = dmRes.body.result.id;

    const [dmNhapRes, xuatRes] = await Promise.all([
      rpc(getKhoToken(), 'dmNhap', { dm_id: dmId }),
      rpc(getKhoToken(), 'xuatKho', { vattu_id: vt2, so_luong: 12, ly_do: 'race-dm' }),
    ]);

    expect(dmNhapRes.body.ok).toBe(true); // nhập không bao giờ bị chặn (chỉ tăng)
    //Xuất CHỈ ok khi tại THỜI ĐIỂM ĐOẠT ROW-LOCK tồn đã ≥ 12 — không có lịch trình
    //nào để "cả hai cùng thắng gây âm".
    if (xuatRes.body.ok !== true) expect(String(xuatRes.body.error)).toMatch(/^Thiếu tồn kho/);

    const tonCuoi = await getTon(vt2);
    expect(tonCuoi).toBeGreaterThanOrEqual(0);
    // Bất biến quyết định (deterministic invariant): ton_final = 10 + 6 − 12·[xuat ok]
    expect(tonCuoi).toBe(xuatRes.body.ok === true ? 4 : 16);
    // DM chỉ sang da_nhap một lần, phiếu xuất (nếu có) đúng 1 dòng commit
    const dm = (await db.query('SELECT trang_thai FROM dm WHERE id = $1', [dmId])).rows[0];
    expect(dm.trang_thai).toBe('da_nhap');
    expect(await countPhieu('xuat', vt2)).toBe(xuatRes.body.ok === true ? 1 : 0);
  });

  test('hồi quy đơn lẻ: xuatKho vượt tồn vẫn báo "Thiếu tồn kho", đúng = {ok,result}', async () => {
    const before = await getTon(vtId); // 14
    const res = await rpc(getKhoToken(), 'xuatKho', { vattu_id: vtId, so_luong: 15, ly_do: 'exceed' });
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error)).toContain('Thiếu tồn kho');
    expect(await getTon(vtId)).toBe(before);
    const okRes = await rpc(getKhoToken(), 'xuatKho', { vattu_id: vtId, so_luong: 14, ly_do: 'du ton' });
    expect(okRes.body.ok).toBe(true);
    expect(okRes.body.result.id).toMatch(/^NX-\d{6}$/);
    expect(await getTon(vtId)).toBe(0);
  });
});
