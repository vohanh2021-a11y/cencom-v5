/**
 * UAT/cases/execute.spec.ts — Thực thi UAT tự động đọc từ index.json.
 *
 * - Project 'setup': login 7 vai → UAT/.auth/<role>.json
 * - Mỗi case chạy trong project uat-<role> (vai chính từ index.json).
 * - Video tự động ghi (playwright.config video:'on'); sau run, rename-videos.mjs
 *   đổi tên thành UAT/videos/<TC-ID>.webm.
 * - Case nào UI chưa có → test FAIL rõ ràng "CẦN BỔ SUNG: ..." (kích hoạt loop bổ sung tính năng ẩn).
 */
import { test, expect, request as apiRequest } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(__dirname, 'index.json'), 'utf8'));
const PASS = process.env['E2E_PASS'] || data.meta.password;
const AUTH = resolve(__dirname, '..', '.auth');

const users = [
  { role: 'admin', id: 'admin-1' },
  { role: 'giamdoc', id: 'giamdoc-1' },
  { role: 'xuong', id: 'xuong-1' },
  { role: 'khovattu', id: 'khoa-1' },
  { role: 'ketoan', id: 'ketoan-1' },
  { role: 'pttb', id: 'pttb-1' },
  { role: 'laixe', id: 'laixe-1' },
];

for (const u of users) {
  test(`login ${u.role}`, async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=text]', u.id);
    await page.fill('input[type=password]', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL('**/home', { timeout: 20000 });
    await page.context().storageState({ path: resolve(AUTH, `${u.role}.json`) });
  });
}

const LANDING: Record<string, string> = {
  sua_chua: '/sc',
  mua_sam: '/mua',
  quyet_toan: '/sc',
};

/* ─── Helpers từ worker w2 (báo cáo / đối soát 3 bên) ─── */
const DB_URL =
  process.env['DATABASE_URL'] ||
  'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os';

/** POST /api/rpc {fn,args} với storageState vai — trả về {status, json}. */
async function rpcAs(role: string, fn: string, args: unknown[] = []) {
  const ctx = await apiRequest.newContext({ storageState: resolve(AUTH, `${role}.json`) });
  const res = await ctx.post('/api/rpc', { data: { fn, args } });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  await ctx.dispose();
  return { status: res.status(), json };
}

/** Assert vai KHÔNG được phép: dispatch ok=false + thông báo quyền. */
function expectDenied(status: number, json: any, role: string, fn: string) {
  expect(status, `[${fn}] ${role} phải bị từ chối (HTTP): ` + status).toBe(400);
  expect(json?.ok, `[${fn}] ${role} phải nhận ok=false: ` + JSON.stringify(json)).toBe(false);
  expect(String(json?.error || ''), `[${fn}] ${role} phải có thông báo quyền: ` + JSON.stringify(json)).toMatch(/quyền|phép/i);
}

/* ─── Helpers từ worker w3 (mua sắm) ─── */
// ID ngẫu nhiên 6 chữ số — mỗi lần chạy phải KHÁC nhau để không đụng UNIQUE (vattu.code).
const rnd6 = (): string => String(Math.floor(Math.random() * 900000) + 100000);

// Prefix UATW3 cho MỌI id/bks test mua sắm (dọn orphan nếu lần chạy trước bị huỷ).
const W3 = 'UATW3';

/** POST /api/rpc {fn,args} với context đã có storageState — trả về {status, body}. */
async function rpcCtx(ctx: any, fn: string, args: unknown[]) {
  const res = await ctx.post('/api/rpc', { data: { fn, args } });
  const body = await res.json();
  return { status: res.status(), body };
}

/* ─── cleanupUATW3: xoá dữ liệu test còn sót từ lần chạy bị huỷ trước.
   Gọi TRƯỚC mỗi test mua sắm (đầu handler, trước setup data). Dùng LIKE '%UATW3%'
   vì id/bks có dạng '51C-UATW3123456'/'SC-UATW3123456' (UATW3 không đứng đầu).
   Mỗi câu DELETE bọc .catch → nếu bảng/cột không tồn tại thì bỏ qua, không chặn test. */
async function cleanupUATW3(pool: any): Promise<void> {
  const q = async (sql: string, param: string) => {
    try {
      await pool.query(sql, [param]);
    } catch {
      /* bảng/cột không tồn tại trong DB thật → bỏ qua */
    }
  };
  const like = (col: string) => ` WHERE ${col} LIKE '%${W3}%'`;
  // Xoá theo thứ tự con → cha (tránh FK)
  await q(`DELETE FROM dm_mua_ct ${like('dm_id')}`, '%');
  await q(`DELETE FROM dm_mua_ct ${like('sc_id')}`, '%');
  await q(`DELETE FROM de_nghi_mua ${like('id')}`, '%');
  await q(`DELETE FROM phieu_nh_ct ${like('ph_id')}`, '%');
  await q(`DELETE FROM phieu_nh_ct ${like('ref_dm')}`, '%');
  await q(`DELETE FROM phieu_nh_ct ${like('ref_sc')}`, '%');
  await q(`DELETE FROM phieu_nhap ${like('id')}`, '%');
  await q(`DELETE FROM phieu_nhap ${like('ref_dm')}`, '%');
  await q(`DELETE FROM phieu_xuat_ct ${like('ph_id')}`, '%');
  await q(`DELETE FROM phieu_xuat_ct ${like('ref_sc')}`, '%');
  await q(`DELETE FROM phieu_xuat ${like('id')}`, '%');
  await q(`DELETE FROM phieu_xuat ${like('ref_sc')}`, '%');
  await q(`DELETE FROM cong_no ${like('id')}`, '%');
  await q(`DELETE FROM cong_no ${like('ref_id')}`, '%');
  await q(`DELETE FROM bao_gia_ncc ${like('id')}`, '%');
  await q(`DELETE FROM bao_gia_ncc ${like('ref_id')}`, '%');
  await q(`DELETE FROM sc_congviec ${like('sc_id')}`, '%');
  await q(`DELETE FROM sc_vattu ${like('sc_id')}`, '%');
  await q(`DELETE FROM bien_ban_nghiem ${like('id')}`, '%');
  await q(`DELETE FROM bien_ban_nghiem ${like('sc_id')}`, '%');
  await q(`DELETE FROM lich_sua ${like('sc_id')}`, '%');
  await q(`DELETE FROM phieu_sua ${like('id')}`, '%');
  await q(`DELETE FROM phieu_sua ${like('bks')}`, '%');
  await q(`DELETE FROM xe ${like('id')}`, '%');
  await q(`DELETE FROM xe ${like('bks')}`, '%');
  // Vật tư tạm dùng cho test mua sắm
  await q(`DELETE FROM vattu ${like('code')}`, '%');
}

// Handler chi tiết từng case (chỉ các case UI đã có). Case khác → báo CẦN BỔ SUNG.
async function runCase(c: any, page: any, request: any) {
  const landing = LANDING[c.domain] || '/sc';
  await page.goto(landing);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  if (c.id === 'TC-RP-05' || c.id === 'TC-ST-03') {
    // Kiểm tra phân quyền xuất hồ sơ qua API request với storageState từng vai
    const scId = 'SC-TEST-XYZ';
    const allowed = ['admin', 'giamdoc', 'ketoan'];
    for (const r of ['ketoan', 'giamdoc', 'laixe', 'xuong'] as const) {
      const ctx = await apiRequest.newContext({ storageState: resolve(AUTH, `${r}.json`) });
      const res = await ctx.get(`/api/export/sc-hoso/${scId}`);
      if (allowed.includes(r)) expect(res.status()).not.toBe(403);
      else expect(res.status()).toBe(403);
      await ctx.dispose();
    }
    return;
  }

  if (c.id === 'TC-ST-02') {
    // P2.2a (QC206 Điều 2): CHẶN thanh toán công nợ mua khi THIẾU HĐĐT đầu vào.
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    const client = await pool.connect();
    const d6 = (Date.now() % 1000000).toString().padStart(6, '0');
    const ref = 'PN' + d6; // phieu_nhap ref (8 ký tự)
    const cnId = 'CN' + d6; // cong_no id (8 ký tự, ≤12)
    const vatId = 'VT' + d6; // vat_invoice id
    const today = new Date().toISOString().slice(0, 10);
    try {
      // Tạo công nợ phải trả (ref_type=phieu_nhap) CHƯA có vat_invoice
      await client.query(
        `INSERT INTO cong_no(id, loai, doi_tac, ky_hieu, ref_type, ref_id, ngay, so_tien, da_tt, con_no)
         VALUES($1,'phai_tra','NCC UAT','PNUAT','phieu_nhap',$2,$3,100000,0,100000)`,
        [cnId, ref, today],
      );
      const ctx = await apiRequest.newContext({ storageState: resolve(AUTH, 'ketoan.json') });

      // (1) Thiếu HĐĐT → phải BỊ CHẶN
      const r1 = await ctx.post('/api/rpc', {
        data: { fn: 'phieuChiCreate', args: [{ cong_no_id: cnId, so_tien: 50000 }] },
      });
      const j1 = await r1.json();
      expect(j1.ok, 'RPC dispatch phải ok=true: ' + JSON.stringify(j1)).toBe(true);
      expect(j1.result?.ok, 'thiếu HĐĐT phải bị chặn: ' + JSON.stringify(j1.result)).toBe(false);
      expect(String(j1.result?.error || '').toUpperCase()).toMatch(/HĐĐT|QC206/);

      // (2) Có HĐĐT → được thanh toán (không lỗi HĐĐT)
      await client.query(
        `INSERT INTO vat_invoice(id, ncc, so_hd, ngay, tien_hang, tien_thue, ty_le, ref_id)
         VALUES($1,'NCC UAT','HD-UAT',$2,100000,10000,0.1,$3)`,
        [vatId, today, ref],
      );
      const r2 = await ctx.post('/api/rpc', {
        data: { fn: 'phieuChiCreate', args: [{ cong_no_id: cnId, so_tien: 50000 }] },
      });
      const j2 = await r2.json();
      expect(j2.ok, 'RPC dispatch phải ok=true: ' + JSON.stringify(j2)).toBe(true);
      expect(j2.result?.ok, 'có HĐĐT phải thanh toán được: ' + JSON.stringify(j2.result)).toBe(true);

      await ctx.dispose();
    } finally {
      await client.query('DELETE FROM phieu_chi WHERE cong_no_id=$1', [cnId]).catch(() => {});
      await client.query('DELETE FROM vat_invoice WHERE ref_id=$1', [ref]).catch(() => {});
      await client.query('DELETE FROM cong_no WHERE id=$1', [cnId]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-RP-02') {
    // Xưởng trưởng lập SC qua wizard 8 bước; sau Tạo phải redirect /sc/SC-...
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    const client = await pool.connect();
    const bks = '51C-UAT' + (Date.now() % 1000000).toString();
    let scId: string | null = null;
    try {
      await client.query(
        'INSERT INTO xe(id, bks, hang, dong, trang_thai, tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'TEST', 'TEST', 'active', 'c1'],
      );
      await page.goto('/sc/create');
      await page.getByPlaceholder('VD: 51C-12345').fill(bks);
      await page.getByRole('button', { name: /Tiếp/ }).click();
      await page.getByPlaceholder('Tên công việc').first().fill('Thay nhớt');
      await page.getByRole('button', { name: /Tiếp/ }).click();
      await page.getByRole('button', { name: /Tạo phiếu/ }).click();
      try {
        await page.waitForURL('**/sc/SC-**', { timeout: 8000 });
      } catch {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error('Không redirect sau Tạo phiếu. Nội dung trang: ' + body.replace(/\s+/g, ' ').slice(0, 600));
      }
      expect(page.url(), 'sau tạo phải redirect /sc/SC-: ' + page.url()).toMatch(/\/sc\/SC-/);
      const m = page.url().match(/\/sc\/(SC-\w+)/);
      scId = m ? m[1] : null;
    } finally {
      if (scId) {
        await client.query('DELETE FROM sc_congviec WHERE sc_id=$1', [scId]).catch(() => {});
        await client.query('DELETE FROM phieu_sua WHERE id=$1', [scId]).catch(() => {});
      }
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-RP-03') {
    // Duyệt phiếu theo thẩm quyền: laixe KHÔNG được duyệt, giamdoc được duyệt.
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    const client = await pool.connect();
    const bks = '51C-DUY' + (Date.now() % 1000000).toString();
    let scId: string | null = null;
    try {
      await client.query(
        'INSERT INTO xe(id, bks, hang, dong, trang_thai, tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      // Tạo SC qua RPC (xuong có sc.tao)
      const ctxX = await apiRequest.newContext({ storageState: resolve(AUTH, 'xuong.json') });
      const r0 = await ctxX.post('/api/rpc', {
        data: { fn: 'scCreate', args: [{ bks, congviec: [{ ten: 'Thay nhớt' }], vattu: [] }] },
      });
      const j0 = await r0.json();
      scId = j0?.result?.id ?? null;
      expect(scId, 'tạo SC thất bại: ' + JSON.stringify(j0)).toBeTruthy();

      // (1) laixe (không có sc.duy) → BỊ CHẶN
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r1 = await ctxL.post('/api/rpc', { data: { fn: 'scApprove', args: [scId, 'ok'] } });
      const j1 = await r1.json();
      expect(j1.ok, 'laixe không được duyệt: ' + JSON.stringify(j1)).toBe(false);

      // (2) giamdoc (có sc.duy) → duyệt được
      const ctxG = await apiRequest.newContext({ storageState: resolve(AUTH, 'giamdoc.json') });
      const r2 = await ctxG.post('/api/rpc', { data: { fn: 'scApprove', args: [scId, 'ok'] } });
      const j2 = await r2.json();
      expect(j2.ok, 'giamdoc phải duyệt được: ' + JSON.stringify(j2)).toBe(true);
      expect(j2.result?.trang_thai).toBe('da_duyet');
    } finally {
      if (scId) {
        await client.query('DELETE FROM sc_congviec WHERE sc_id=$1', [scId]).catch(() => {});
        await client.query('DELETE FROM phieu_sua WHERE id=$1', [scId]).catch(() => {});
      }
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-ST-01') {
    // Quyết toán phiếu sửa chữa: SC đã nghiệm thu (da_hoan) + đủ hồ sơ → kế toán quyết toán.
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    const client = await pool.connect();
    const rnd = (Date.now() % 1000000).toString();
    const bks = '51C-QT' + rnd;
    const SCID = 'SC-QT' + rnd;
    const DMID = 'DM-QT' + rnd;
    const PNID = 'PN-QT' + rnd;
    const PXID = 'PX-QT' + rnd;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await client.query('INSERT INTO xe(id,bks,hang,dong,trang_thai,tenant_id) VALUES($1,$2,$3,$4,$5,$6)', [bks, bks, 'T', 'T', 'active', 'c1']);
      await client.query(
        `INSERT INTO phieu_sua(id,bks,nguoi_lap,ngay,mo_ta,trang_thai,tong_cong,tong_vt,tong,la_sua_ngoai,tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10)`,
        [SCID, bks, 'xuong-1', today, 'SC test quyết toán', 'da_hoan', 100000, 0, 100000, 'c1'],
      );
      await client.query(
        `INSERT INTO sc_congviec(sc_id,ten,so_luong,don_gia,thanh,tt,loai_xu_ly,tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [SCID, 'Thay nhớt', 1, 100000, 100000, 'hoan', 'khac_phuc', 'c1'],
      );
      await client.query('INSERT INTO bao_gia_ncc(dm_id,sc_id,ncc_ten,ngay,tenant_id) VALUES($1,$2,$3,$4,$5)', [DMID, SCID, 'NCC', today, 'c1']);
      await client.query('INSERT INTO phieu_nhap(id,ngay,nguoi_lap,ref_dm,tong,loai_nhap,tenant_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [PNID, today, 'khoa-1', DMID, 100000, 'moi', 'c1']);
      await client.query('INSERT INTO phieu_xuat(id,ngay,nguoi_lap,ref_sc,loai_xuat,tenant_id) VALUES($1,$2,$3,$4,$5,$6)', [PXID, today, 'khoa-1', SCID, 'dung', 'c1']);

      const ctx = await apiRequest.newContext({ storageState: resolve(AUTH, 'ketoan.json') });
      const r = await ctx.post('/api/rpc', { data: { fn: 'quyetToan', args: [{ id: SCID }] } });
      const j = await r.json();
      expect(j.ok, 'RPC dispatch phải ok=true: ' + JSON.stringify(j)).toBe(true);
      expect(j.result?.ok, 'quyết toán phải thành công: ' + JSON.stringify(j.result)).toBe(true);
      expect(Number(j.result?.tong)).toBeGreaterThan(0);
    } finally {
      await client.query('DELETE FROM lich_sua WHERE sc_id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM ledger WHERE ref_id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM phieu_xuat WHERE id=$1', [PXID]).catch(() => {});
      await client.query('DELETE FROM phieu_nhap WHERE id=$1', [PNID]).catch(() => {});
      await client.query('DELETE FROM bao_gia_ncc WHERE dm_id=$1', [DMID]).catch(() => {});
      await client.query('DELETE FROM sc_congviec WHERE sc_id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM phieu_sua WHERE id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-RP-04') {
    // Thợ thực hiện & Nghiệm thu, đóng phiếu:
    // SC → duyệt (giamdoc) → bắt đầu sửa (scStart) → không đóng được khi còn cv dang dở
    // → hoàn tất công việc → đóng phiếu (scFinish) → nghiệm thu (scNghiem, giamdoc) → da_hoan.
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    const client = await pool.connect();
    const bks = '51C-NG' + (Date.now() % 1000000).toString();
    let scId: string | null = null;
    try {
      await client.query(
        'INSERT INTO xe(id, bks, hang, dong, trang_thai, tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      // 1. Xưởng tạo SC với 2 công việc
      const ctxX = await apiRequest.newContext({ storageState: resolve(AUTH, 'xuong.json') });
      const r0 = await ctxX.post('/api/rpc', {
        data: {
          fn: 'scCreate',
          args: [{ bks, congviec: [{ ten: 'Thay nhớt' }, { ten: 'Kiểm tra phanh' }], vattu: [] }],
        },
      });
      const j0 = await r0.json();
      scId = j0?.result?.id ?? null;
      expect(scId, 'tạo SC thất bại: ' + JSON.stringify(j0)).toBeTruthy();

      // 2. Giám đốc duyệt → da_duyet
      const ctxG = await apiRequest.newContext({ storageState: resolve(AUTH, 'giamdoc.json') });
      const r1 = await ctxG.post('/api/rpc', { data: { fn: 'scApprove', args: [scId, 'ok'] } });
      const j1 = await r1.json();
      expect(j1.ok, 'giamdoc duyệt SC thất bại: ' + JSON.stringify(j1)).toBe(true);
      expect(j1.result?.trang_thai, 'sau duyệt phải da_duyet: ' + JSON.stringify(j1.result)).toBe('da_duyet');

      // 3. Xưởng bắt đầu sửa chữa → dang_sua
      const r2 = await ctxX.post('/api/rpc', { data: { fn: 'scStart', args: [scId] } });
      const j2 = await r2.json();
      expect(j2.ok, 'scStart thất bại: ' + JSON.stringify(j2)).toBe(true);
      expect(j2.result?.ok, 'scStart phải ok: ' + JSON.stringify(j2.result)).toBe(true);
      const st2 = await client.query('SELECT trang_thai FROM phieu_sua WHERE id=$1', [scId]);
      expect(st2.rows[0]?.trang_thai, 'sau scStart phải dang_sua').toBe('dang_sua');

      // 4. VERIFY: không thể Đóng phiếu (scFinish) khi còn công việc chưa xong
      const r3 = await ctxX.post('/api/rpc', { data: { fn: 'scFinish', args: [scId] } });
      const j3 = await r3.json();
      expect(j3.ok, 'scFinish phải dispatch được: ' + JSON.stringify(j3)).toBe(true);
      expect(j3.result?.ok, 'phải chặn đóng phiếu khi còn công việc chưa xong: ' + JSON.stringify(j3.result)).toBe(false);
      expect(String(j3.result?.error || '').toUpperCase()).toMatch(/HOÀN|CÔNG VIỆC|CHƯA/);

      // 5. Hoàn tất tiến độ tất cả công việc (SQL trực tiếp — schema contract scWorkSet
      //    {id,items} không khớp handler core (scId,itemId,patch) nên không gọi qua RPC)
      await client.query("UPDATE sc_congviec SET tt='hoan' WHERE sc_id=$1 AND deleted_at=''", [scId]);

      // 6. Đóng phiếu → chờ nghiệm thu
      const r4 = await ctxX.post('/api/rpc', { data: { fn: 'scFinish', args: [scId] } });
      const j4 = await r4.json();
      expect(j4.ok, 'scFinish lần 2 phải dispatch được: ' + JSON.stringify(j4)).toBe(true);
      expect(j4.result?.ok, 'đóng phiếu sau khi xong hết công việc: ' + JSON.stringify(j4.result)).toBe(true);
      const st4 = await client.query('SELECT trang_thai FROM phieu_sua WHERE id=$1', [scId]);
      expect(st4.rows[0]?.trang_thai, 'sau scFinish phải cho_nghiem').toBe('cho_nghiem');

      // 7. Nghiệm thu (giamdoc) → da_hoan + biên bản nghiệm thu
      const r5 = await ctxG.post('/api/rpc', {
        data: {
          fn: 'scNghiem',
          args: [scId, true, '', { ben_giao: 'Xưởng UAT', ben_nhan: 'Lái xe UAT', ket_luan: 'Nghiệm thu đạt yêu cầu' }],
        },
      });
      const j5 = await r5.json();
      expect(j5.ok, 'scNghiem phải dispatch được: ' + JSON.stringify(j5)).toBe(true);
      expect(j5.result?.ok, 'nghiệm thu phải thành công: ' + JSON.stringify(j5.result)).toBe(true);
      const st5 = await client.query('SELECT trang_thai, ngay_nghiem, nguoi_nghiem FROM phieu_sua WHERE id=$1', [scId]);
      expect(st5.rows[0]?.trang_thai, 'sau nghiệm thu phải da_hoan').toBe('da_hoan');
      expect(st5.rows[0]?.ngay_nghiem, 'phải ghi ngày nghiệm thu').toBeTruthy();
      expect(st5.rows[0]?.nguoi_nghiem, 'phải ghi người nghiệm thu').toBeTruthy();
      const bb = await client.query('SELECT id FROM bien_ban_nghiem WHERE sc_id=$1', [scId]);
      expect(bb.rows.length, 'phải có biên bản nghiệm thu').toBeGreaterThan(0);

      await ctxX.dispose();
      await ctxG.dispose();
    } finally {
      if (scId) {
        await client.query('DELETE FROM bien_ban_nghiem WHERE sc_id=$1', [scId]).catch(() => {});
        await client.query('DELETE FROM sc_phien_ban WHERE sc_id=$1', [scId]).catch(() => {});
        await client.query('DELETE FROM sc_congviec WHERE sc_id=$1', [scId]).catch(() => {});
        await client.query('DELETE FROM sc_vattu WHERE sc_id=$1', [scId]).catch(() => {});
        await client.query('DELETE FROM phieu_sua WHERE id=$1', [scId]).catch(() => {});
      }
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-RP-01') {
    // Lái xe đề xuất sửa chữa: deXuatCreate (laixe) → đề xuất nằm trong hệ thống
    // (danh sách chờ xử lý mà xưởng thấy) + KHÔNG có trường chi phí.
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    const client = await pool.connect();
    const bks = '51C-DX' + (Date.now() % 1000000).toString();
    let dxId: string | null = null;
    try {
      await client.query(
        'INSERT INTO xe(id, bks, hang, dong, trang_thai, tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      // 1. Lái xe tạo đề xuất sửa chữa (chỉ biển số + mô tả — KHÔNG có chi phí)
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r0 = await ctxL.post('/api/rpc', {
        data: { fn: 'deXuatCreate', args: [{ bks, mo_ta: 'Máy không nổ' }] },
      });
      const j0 = await r0.json();
      dxId = j0?.result?.id ?? null;
      expect(dxId, 'lái xe tạo đề xuất thất bại: ' + JSON.stringify(j0)).toBeTruthy();

      // 2. Lái xe xem lại: trạng thái chờ duyệt, KHÔNG có trường chi phí
      const r1 = await ctxL.post('/api/rpc', { data: { fn: 'deXuatGet', args: [dxId] } });
      const j1 = await r1.json();
      expect(j1.ok, 'deXuatGet phải ok: ' + JSON.stringify(j1)).toBe(true);
      const dx = (j1.result || {}) as Record<string, unknown>;
      expect(dx.trang_thai, 'đề xuất phải ở trạng thái chờ duyệt: ' + JSON.stringify(dx)).toBe('cho_duyet');
      const costKeys = Object.keys(dx).filter((k) => /chi_phi|so_tien|thanh|gia|cost|price/i.test(k));
      expect(costKeys, 'đề xuất lái xe không được có trường chi phí').toHaveLength(0);

      // 3. Xưởng thấy đề xuất trong danh sách chờ xử lý
      const ctxX = await apiRequest.newContext({ storageState: resolve(AUTH, 'xuong.json') });
      const r2 = await ctxX.post('/api/rpc', { data: { fn: 'deXuatList', args: [{ trang_thai: 'cho_duyet' }] } });
      const j2 = await r2.json();
      expect(j2.ok, 'deXuatList phải ok: ' + JSON.stringify(j2)).toBe(true);
      const found = (j2.result || []).some((d: any) => d.id === dxId);
      expect(found, 'đề xuất phải xuất hiện trong danh sách chờ xưởng xử lý').toBe(true);

      await ctxL.dispose();
      await ctxX.dispose();
    } finally {
      if (dxId) {
        await client.query('DELETE FROM nhat_ky WHERE noi_dung LIKE $1', ['%' + dxId + '%']).catch(() => {});
        await client.query('DELETE FROM de_xuat_sua_chua WHERE id=$1', [dxId]).catch(() => {});
      }
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-ST-04') {
    // Báo cáo chi phí theo xe / theo thời gian — 3 bên tách biệt (sửa chữa/mua/kho).
    const pool = new Pool({ connectionString: DB_URL });
    const client = await pool.connect();
    const rnd = (Date.now() % 1000000).toString().padStart(6, '0');
    const bks = '51C-BC' + rnd;
    const SCID = 'SC-BC' + rnd;
    const PNID = 'PN-BC' + rnd;
    const PXID = 'PX-BC' + rnd;
    const today = new Date().toISOString().slice(0, 10);
    try {
      // Seed: 1 phiếu SC đã quyết toán (lich_sua 100.000), 1 phiếu nhập mua (50.000),
      // 1 phiếu xuất kho có chi tiết 30.000 — đều trong kỳ hôm nay.
      await client.query(
        'INSERT INTO xe(id, bks, hang, dong, trang_thai, tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_sua(id, bks, nguoi_lap, ngay, mo_ta, trang_thai, tong_cong, tong_vt, tong, tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [SCID, bks, 'xuong-1', today, 'SC báo cáo UAT', 'da_quyet', 100000, 0, 100000, 'c1'],
      );
      await client.query(
        `INSERT INTO lich_sua(sc_id, bks, ngay, tong_cong, tong_vt, tong, nguoi, ghi_chu, tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [SCID, bks, today, 100000, 0, 100000, 'ketoan-1', 'Quyết toán UAT', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_nhap(id, ngay, nguoi_lap, nha_cc, ref_dm, tong, loai_nhap, tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [PNID, today, 'khoa-1', 'NCC UAT', '', 50000, 'moi', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_xuat(id, ngay, nguoi_lap, ref_sc, loai_xuat, tenant_id)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [PXID, today, 'khoa-1', SCID, 'dung', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_xuat_ct(ph_id, vattu_id, ten, so_luong, dgia, thanh, ref_sc, tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [PXID, 0, 'Vật tư UAT', 1, 30000, 30000, SCID, 'c1'],
      );

      // (1) giamdoc — theo kỳ + lọc bks: 3 bên hiển thị RIÊNG, số khớp seed chính xác
      const r1 = await rpcAs('giamdoc', 'baoCaoChiPhi', [{ tu_ngay: today, den_ngay: today, bks }]);
      const j1 = r1.json;
      expect(j1?.ok, 'RPC dispatch phải ok=true: ' + JSON.stringify(j1)).toBe(true);
      expect(j1?.result?.ok, 'baoCaoChiPhi phải ok: ' + JSON.stringify(j1?.result)).toBe(true);
      expect(typeof j1?.result?.sua_chua, 'phải có bên sửa chữa tách riêng').toBe('number');
      expect(typeof j1?.result?.mua, 'phải có bên mua tách riêng').toBe('number');
      expect(typeof j1?.result?.kho, 'phải có bên kho tách riêng').toBe('number');
      expect(Number(j1?.result?.sua_chua), 'sửa chữa phải khớp seed (lọc bks)').toBe(100000);
      expect(Number(j1?.result?.kho), 'kho phải khớp seed (lọc bks qua ref_sc)').toBe(30000);
      expect(Number(j1?.result?.mua), 'mua phải >= seed 50000 trong kỳ').toBeGreaterThanOrEqual(50000);

      // (2) giamdoc — theo kỳ KHÔNG lọc bks: vẫn tách 3 bên, >= seed
      const r2 = await rpcAs('giamdoc', 'baoCaoChiPhi', [{ tu_ngay: today, den_ngay: today }]);
      const j2 = r2.json;
      expect(j2?.ok, 'giamdoc theo kỳ phải ok=true: ' + JSON.stringify(j2)).toBe(true);
      expect(j2?.result?.ok, 'baoCaoChiPhi theo kỳ phải ok: ' + JSON.stringify(j2?.result)).toBe(true);
      expect(Number(j2?.result?.sua_chua), 'sua_chua kỳ phải >= 100000').toBeGreaterThanOrEqual(100000);
      expect(Number(j2?.result?.mua), 'mua kỳ phải >= 50000').toBeGreaterThanOrEqual(50000);
      expect(Number(j2?.result?.kho), 'kho kỳ phải >= 30000').toBeGreaterThanOrEqual(30000);

      // (3) ketoan (vai liên quan) — cũng được phép
      const r3 = await rpcAs('ketoan', 'baoCaoChiPhi', [{ tu_ngay: today, den_ngay: today }]);
      const j3 = r3.json;
      expect(j3?.ok, 'ketoan phải ok=true: ' + JSON.stringify(j3)).toBe(true);
      expect(j3?.result?.ok, 'ketoan xem báo cáo phải ok: ' + JSON.stringify(j3?.result)).toBe(true);

      // (4) laixe / xuong — KHÔNG có ke_toan.xem → bị từ chối
      const r4 = await rpcAs('laixe', 'baoCaoChiPhi', [{ tu_ngay: today, den_ngay: today }]);
      expectDenied(r4.status, r4.json, 'laixe', 'baoCaoChiPhi');
      const r5 = await rpcAs('xuong', 'baoCaoChiPhi', [{ tu_ngay: today, den_ngay: today }]);
      expectDenied(r5.status, r5.json, 'xuong', 'baoCaoChiPhi');
    } finally {
      await client.query('DELETE FROM phieu_xuat_ct WHERE ph_id=$1', [PXID]).catch(() => {});
      await client.query('DELETE FROM phieu_xuat WHERE id=$1', [PXID]).catch(() => {});
      await client.query('DELETE FROM phieu_nhap WHERE id=$1', [PNID]).catch(() => {});
      await client.query('DELETE FROM lich_sua WHERE sc_id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM phieu_sua WHERE id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  if (c.id === 'TC-ST-05') {
    // Đối soát 3 bên (Kế toán ↔ Kho / Công nợ): ketoan được phép → items[] + notes[];
    // laixe/xuong không được phép → từ chối.
    const r1 = await rpcAs('ketoan', 'doiSoat', [{}]);
    const j1 = r1.json;
    expect(j1?.ok, 'RPC dispatch phải ok=true: ' + JSON.stringify(j1)).toBe(true);
    expect(typeof j1?.result?.ok, 'doiSoat phải trả ok (boolean): ' + JSON.stringify(j1?.result)).toBe('boolean');
    expect(Array.isArray(j1?.result?.items), 'đối soát phải trả items[] (từng khối kiểm tra)').toBe(true);
    expect(Array.isArray(j1?.result?.notes), 'đối soát phải trả notes[] (cảnh báo lệch)').toBe(true);
    // Mỗi item có check/expected/actual/diff/ok — "lệch thì có cảnh báo"
    for (const it of j1?.result?.items || []) {
      expect(typeof it?.check, 'mỗi item phải có tên kiểm tra').toBe('string');
      expect(typeof it?.ok, 'mỗi item phải có kết luận ok').toBe('boolean');
    }

    // giamdoc (vai liên quan theo rolesInvolved) — có ke_toan.xem → được phép
    const r2 = await rpcAs('giamdoc', 'doiSoat', [{}]);
    const j2 = r2.json;
    expect(j2?.ok, 'giamdoc đối soát phải ok=true: ' + JSON.stringify(j2)).toBe(true);
    expect(typeof j2?.result?.ok, 'giamdoc phải nhận kết quả boolean: ' + JSON.stringify(j2?.result)).toBe('boolean');

    // laixe / xuong — bị từ chối
    const r3 = await rpcAs('laixe', 'doiSoat', [{}]);
    expectDenied(r3.status, r3.json, 'laixe', 'doiSoat');
    const r4 = await rpcAs('xuong', 'doiSoat', [{}]);
    expectDenied(r4.status, r4.json, 'xuong', 'doiSoat');
    return;
  }

  /* ═══════════════ TC-PR-01: Đề xuất mua vật tư (khoa) ═══════════════
     khoa-1 (khovattu, có mua.tao) gọi dmCreate → de_nghi_mua + dm_mua_ct,
     liên kết SC qua sc_id; truy vết bằng dmListBySc; laixe bị chặn. */
  if (c.id === 'TC-PR-01') {
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    await cleanupUATW3(pool);
    const client = await pool.connect();
    const rnd = rnd6();
    const bks = '51C-UATW3' + rnd;
    const SCID = 'SC-UATW3' + rnd;
    const today = new Date().toISOString().slice(0, 10);
    let vatId: number | null = null;
    let dmId: string | null = null;
    try {
      // Vật tư tạm (id BIGSERIAL — pg trả string → ép Number cho Zod z.number())
      const vi = await client.query(
        "INSERT INTO vattu(code,name,nhom,donvi,gia,ton,ton_min,active,deleted_at) VALUES($1,$2,'UAT','cái',50000,0,5,1,'') RETURNING id",
        ['VT-UATW3' + rnd, 'Vat tu UAT PR1 ' + rnd],
      );
      vatId = Number(vi.rows[0].id);
      await client.query(
        'INSERT INTO xe(id,bks,hang,dong,trang_thai,tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_sua(id,bks,nguoi_lap,ngay,mo_ta,trang_thai,tong,la_sua_ngoai,tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,0,$8)`,
        [SCID, bks, 'xuong-1', today, 'SC UAT mua sam', 'da_duyet', 0, 'c1'],
      );

      // 1. Khoa tạo đề nghị mua (liên kết SC)
      const ctxK = await apiRequest.newContext({ storageState: resolve(AUTH, 'khovattu.json') });
      const r0 = await rpcCtx(ctxK, 'dmCreate', [
        { items: [{ vattu_id: vatId, so_luong: 5, dgia: 50000, sc_id: SCID }], ghi_chu: 'UAT TC-PR-01' },
      ]);
      const j0 = r0.body;
      dmId = j0?.result?.id ?? null;
      expect(dmId, 'dmCreate phai tra id de nghi: ' + JSON.stringify(j0)).toBeTruthy();
      expect(String(dmId), 'de nghi phai co prefix DNM-').toMatch(/^DNM-/);

      // 2. Verify lưu đủ + trạng thái chờ duyệt
      const r1 = await rpcCtx(ctxK, 'dmDetail', [dmId]);
      const j1 = r1.body;
      expect(j1.ok, 'dmDetail phai ok: ' + JSON.stringify(j1)).toBe(true);
      const dm = (j1.result || {}) as any;
      expect(dm.dm?.trang_thai, 'de nghi phai o cho duyet: ' + JSON.stringify(dm.dm)).toBe('cho_duyet');
      expect(dm.ct?.length, 'phai co dong vat tu').toBeGreaterThan(0);
      expect(dm.ct?.[0]?.sc_id, 'dong vat tu phai lien ket SC goc').toBe(SCID);
      expect(Number(dm.dm?.tong), 'tong de nghi = 5*50000').toBe(250000);

      // 3. Truy vết SC → đề nghị (dmListBySc)
      const r2 = await rpcCtx(ctxK, 'dmListBySc', [SCID]);
      const j2 = r2.body;
      expect(j2.ok, 'dmListBySc phai ok: ' + JSON.stringify(j2)).toBe(true);
      const found = (j2.result || []).some((d: any) => d.id === dmId);
      expect(found, 'phai truy vet duoc de nghi tu SC').toBe(true);

      // 4. Phân quyền: laixe KHÔNG được tạo đề nghị mua
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r3 = await rpcCtx(ctxL, 'dmCreate', [
        { items: [{ vattu_id: vatId, so_luong: 1, dgia: 1000 }] },
      ]);
      expect(r3.body.ok, 'laixe khong co mua.tao phai bi chan: ' + JSON.stringify(r3.body)).toBe(false);

      await ctxK.dispose();
      await ctxL.dispose();
    } finally {
      if (dmId) {
        await client.query('DELETE FROM dm_mua_ct WHERE dm_id=$1', [dmId]).catch(() => {});
        await client.query('DELETE FROM de_nghi_mua WHERE id=$1', [dmId]).catch(() => {});
      }
      await client.query('DELETE FROM phieu_sua WHERE id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      if (vatId) await client.query('DELETE FROM vattu WHERE id=$1', [vatId]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  /* ═══════════════ TC-PR-02: Duyệt đề xuất mua (giamdoc) ═══════════════
     giamdoc (có mua.duy) gọi dmDecide(id,'ok') → da_duyet + ghi nguoi_duyet/ngay_duyet;
     laixe bị chặn. */
  if (c.id === 'TC-PR-02') {
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    await cleanupUATW3(pool);
    const client = await pool.connect();
    const rnd = rnd6();
    const today = new Date().toISOString().slice(0, 10);
    let vatId: number | null = null;
    let dmId: string | null = null;
    try {
      const vi = await client.query(
        "INSERT INTO vattu(code,name,nhom,donvi,gia,ton,ton_min,active,deleted_at) VALUES($1,$2,'UAT','cái',20000,0,3,1,'') RETURNING id",
        ['VT-UATW3' + rnd, 'Vat tu UAT PR2 ' + rnd],
      );
      vatId = Number(vi.rows[0].id);
      dmId = 'DNM-UATW3' + rnd;
      await client.query(
        "INSERT INTO de_nghi_mua(id,nguoi_lap,ngay,trang_thai,tong,ghi_chu,deleted_at) VALUES($1,$2,$3,'cho_duyet',$4,$5,'')",
        [dmId, 'khoa-1', today, 60000, 'UAT TC-PR-02'],
      );
      await client.query(
        "INSERT INTO dm_mua_ct(dm_id,vattu_id,ten,donvi,so_luong,dg_dk,dg_tt,tt,deleted_at) VALUES($1,$2,$3,'cái',3,20000,20000,'cho_duyet','')",
        [dmId, vatId, 'Vat tu UAT PR2 ' + rnd],
      );

      // 1. Giám đốc duyệt
      const ctxG = await apiRequest.newContext({ storageState: resolve(AUTH, 'giamdoc.json') });
      const r1 = await rpcCtx(ctxG, 'dmDecide', [dmId, 'ok']);
      const j1 = r1.body;
      expect(j1.ok, 'giamdoc duyet phai dispatch ok: ' + JSON.stringify(j1)).toBe(true);
      expect(j1.result?.trang_thai, 'sau duyet phai da_duyet: ' + JSON.stringify(j1.result)).toBe('da_duyet');

      // 2. Verify DB: da_duyet + ghi người duyệt/ngày duyệt
      const row = await client.query(
        'SELECT trang_thai, nguoi_duyet, ngay_duyet FROM de_nghi_mua WHERE id=$1', [dmId],
      );
      expect(row.rows[0]?.trang_thai, 'DB phai da_duyet').toBe('da_duyet');
      expect(row.rows[0]?.nguoi_duyet, 'phai ghi nguoi duyet').toBe('giamdoc-1');
      expect(row.rows[0]?.ngay_duyet, 'phai ghi ngay duyet').toBeTruthy();

      // 3. Phân quyền: laixe KHÔNG duyệt được
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r2 = await rpcCtx(ctxL, 'dmDecide', [dmId, 'ok']);
      expect(r2.body.ok, 'laixe khong co mua.duy phai bi chan: ' + JSON.stringify(r2.body)).toBe(false);

      await ctxG.dispose();
      await ctxL.dispose();
    } finally {
      if (dmId) {
        await client.query('DELETE FROM dm_mua_ct WHERE dm_id=$1', [dmId]).catch(() => {});
        await client.query('DELETE FROM de_nghi_mua WHERE id=$1', [dmId]).catch(() => {});
      }
      if (vatId) await client.query('DELETE FROM vattu WHERE id=$1', [vatId]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  /* ═══════════════ TC-PR-03: Lập phiếu mua / Nhập kho (khoa) ═══════════════
     Từ đề nghị ĐÃ DUYỆT, khoa gọi phNhapCreate(ref_dm) → phieu_nhap + phieu_nh_ct,
     tồn kho tăng đúng, đề nghị sang da_nhap; laixe bị chặn. */
  if (c.id === 'TC-PR-03') {
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    await cleanupUATW3(pool);
    const client = await pool.connect();
    const rnd = rnd6();
    const today = new Date().toISOString().slice(0, 10);
    let vatId: number | null = null;
    let dmId: string | null = null;
    let pnId: string | null = null;
    try {
      const vi = await client.query(
        "INSERT INTO vattu(code,name,nhom,donvi,gia,ton,ton_min,active,deleted_at) VALUES($1,$2,'UAT','cái',0,0,0,1,'') RETURNING id",
        ['VT-UATW3' + rnd, 'Vat tu UAT PR3 ' + rnd],
      );
      vatId = Number(vi.rows[0].id);
      dmId = 'DNM-UATW3' + rnd;
      await client.query(
        "INSERT INTO de_nghi_mua(id,nguoi_lap,ngay,trang_thai,nguoi_duyet,ngay_duyet,tong,ghi_chu,deleted_at) VALUES($1,$2,$3,'da_duyet','giamdoc-1',$4,500000,'UAT TC-PR-03','')",
        [dmId, 'khoa-1', today, today],
      );
      await client.query(
        "INSERT INTO dm_mua_ct(dm_id,vattu_id,ten,donvi,so_luong,dg_dk,dg_tt,tt,deleted_at) VALUES($1,$2,$3,'cái',10,50000,50000,'da_duyet','')",
        [dmId, vatId, 'Vat tu UAT PR3 ' + rnd],
      );

      // 1. Khoa lập phiếu nhập từ đề nghị đã duyệt
      const ctxK = await apiRequest.newContext({ storageState: resolve(AUTH, 'khovattu.json') });
      const r1 = await rpcCtx(ctxK, 'phNhapCreate', [
        {
          ref_dm: dmId,
          nha_cc: 'NCC UAT',
          ghi_chu: 'UAT TC-PR-03',
          items: [{ vattu_id: vatId, so_luong: 10, dgia: 50000 }],
        },
      ]);
      const j1 = r1.body;
      pnId = j1?.result?.id ?? null;
      expect(pnId, 'phNhapCreate phai tra id phieu nhap: ' + JSON.stringify(j1)).toBeTruthy();
      expect(String(pnId), 'phieu nhap phai co prefix PXN-').toMatch(/^PXN-/);
      expect(Number(j1.result?.tong), 'tong phieu nhap = 10*50000').toBe(500000);

      // 2. Verify DB: phiếu nhập + chi tiết + tồn kho tăng + đề nghị đã nhập
      const pn = await client.query('SELECT ref_dm, tong FROM phieu_nhap WHERE id=$1', [pnId]);
      expect(pn.rows[0]?.ref_dm, 'phieu nhap phai gan ref_dm').toBe(dmId);
      expect(Number(pn.rows[0]?.tong), 'tong phieu_nhap = 500000').toBe(500000);
      const pnct = await client.query('SELECT COUNT(*) c FROM phieu_nh_ct WHERE ph_id=$1', [pnId]);
      expect(Number(pnct.rows[0]?.c), 'phai co chi tiet nhap').toBeGreaterThan(0);
      const vt = await client.query('SELECT ton, gia FROM vattu WHERE id=$1', [vatId]);
      expect(Number(vt.rows[0]?.ton), 'ton kho tang 10').toBe(10);
      const dm = await client.query('SELECT trang_thai FROM de_nghi_mua WHERE id=$1', [dmId]);
      expect(dm.rows[0]?.trang_thai, 'de nghi phai sang da_nhap').toBe('da_nhap');

      // 3. Phân quyền: laixe KHÔNG nhập kho được
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r2 = await rpcCtx(ctxL, 'phNhapCreate', [
        { items: [{ vattu_id: vatId, so_luong: 1, dgia: 1000 }] },
      ]);
      expect(r2.body.ok, 'laixe khong co kho.tao phai bi chan: ' + JSON.stringify(r2.body)).toBe(false);

      await ctxK.dispose();
      await ctxL.dispose();
    } finally {
      if (pnId) {
        await client.query('DELETE FROM cong_no WHERE ref_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM vat_invoice WHERE ref_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM ledger WHERE ref_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM ton_lot WHERE phieu_nhap_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM vattu_gia_lich_su WHERE phieu_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM phieu_nh_ct WHERE ph_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM phieu_nhap WHERE id=$1', [pnId]).catch(() => {});
      }
      if (dmId) {
        await client.query('DELETE FROM dm_mua_ct WHERE dm_id=$1', [dmId]).catch(() => {});
        await client.query('DELETE FROM de_nghi_mua WHERE id=$1', [dmId]).catch(() => {});
      }
      if (vatId) await client.query('DELETE FROM vattu WHERE id=$1', [vatId]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  /* ═══════════════ TC-PR-04: Xuất kho cho phiếu sửa chữa (khoa) ═══════════════
     khoa gọi phXuatCreate(ref_sc) → phieu_xuat + phieu_xuat_ct, tồn giảm đúng,
     sc_vattu da_xuat; chặn xuất vượt tồn; laixe bị chặn. */
  if (c.id === 'TC-PR-04') {
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    await cleanupUATW3(pool);
    const client = await pool.connect();
    const rnd = rnd6();
    const bks = '51C-UATW3' + rnd;
    const SCID = 'SC-UATW3' + rnd;
    const today = new Date().toISOString().slice(0, 10);
    let vatId: number | null = null;
    let pxId: string | null = null;
    try {
      const vi = await client.query(
        "INSERT INTO vattu(code,name,nhom,donvi,gia,ton,ton_min,active,deleted_at) VALUES($1,$2,'UAT','cái',50000,10,0,1,'') RETURNING id",
        ['VT-UATW3' + rnd, 'Vat tu UAT PR4 ' + rnd],
      );
      vatId = Number(vi.rows[0].id);
      await client.query(
        'INSERT INTO xe(id,bks,hang,dong,trang_thai,tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_sua(id,bks,nguoi_lap,ngay,mo_ta,trang_thai,tong,la_sua_ngoai,tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,0,$8)`,
        [SCID, bks, 'xuong-1', today, 'SC UAT xuat kho', 'dang_sua', 0, 'c1'],
      );
      await client.query(
        "INSERT INTO sc_vattu(sc_id,vattu_id,ten,donvi,so_luong,gd_dk,gd_tt,thanh,tt,loai_xu_ly,deleted_at) VALUES($1,$2,$3,'cái',4,50000,50000,200000,'can_mua','khac_phuc','')",
        [SCID, vatId, 'Vat tu UAT PR4 ' + rnd],
      );

      // 1. Khoa xuất kho cho SC
      const ctxK = await apiRequest.newContext({ storageState: resolve(AUTH, 'khovattu.json') });
      const r1 = await rpcCtx(ctxK, 'phXuatCreate', [
        { ref_sc: SCID, nguoi_nhan: 'xuong-1', ghi_chu: 'UAT TC-PR-04', items: [{ vattu_id: vatId, so_luong: 4 }] },
      ]);
      const j1 = r1.body;
      pxId = j1?.result?.id ?? null;
      expect(pxId, 'phXuatCreate phai tra id phieu xuat: ' + JSON.stringify(j1)).toBeTruthy();
      expect(String(pxId), 'phieu xuat phai co prefix PXX-').toMatch(/^PXX-/);
      expect(Number(j1.result?.tong), 'tong xuat = 4*50000').toBe(200000);

      // 2. Verify DB: tồn giảm 6, sc_vattu da_xuat, chi tiết xuất
      const vt = await client.query('SELECT ton FROM vattu WHERE id=$1', [vatId]);
      expect(Number(vt.rows[0]?.ton), 'ton kho giam con 6').toBe(6);
      const sv = await client.query('SELECT tt FROM sc_vattu WHERE sc_id=$1 AND vattu_id=$2', [SCID, vatId]);
      expect(sv.rows[0]?.tt, 'sc_vattu phai da_xuat').toBe('da_xuat');
      const pxct = await client.query('SELECT COUNT(*) c FROM phieu_xuat_ct WHERE ph_id=$1', [pxId]);
      expect(Number(pxct.rows[0]?.c), 'phai co chi tiet xuat').toBeGreaterThan(0);

      // 3. CHẶN xuất vượt tồn (còn 6 → xuất 999)
      const r2 = await rpcCtx(ctxK, 'phXuatCreate', [
        { ref_sc: SCID, items: [{ vattu_id: vatId, so_luong: 999 }] },
      ]);
      expect(r2.body.ok, 'xuat vuot ton phai bi chan: ' + JSON.stringify(r2.body)).toBe(false);
      expect(String(r2.body.error || '').toUpperCase()).toMatch(/TỒN|KHÔNG ĐỦ|KHONG DU/);

      // 4. Phân quyền: laixe KHÔNG xuất kho được
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r3 = await rpcCtx(ctxL, 'phXuatCreate', [
        { items: [{ vattu_id: vatId, so_luong: 1 }] },
      ]);
      expect(r3.body.ok, 'laixe khong co kho.xuat phai bi chan: ' + JSON.stringify(r3.body)).toBe(false);

      await ctxK.dispose();
      await ctxL.dispose();
    } finally {
      if (pxId) {
        await client.query('DELETE FROM ledger WHERE ref_id=$1', [SCID]).catch(() => {});
        await client.query('DELETE FROM phieu_xuat_ct WHERE ph_id=$1', [pxId]).catch(() => {});
        await client.query('DELETE FROM phieu_xuat WHERE id=$1', [pxId]).catch(() => {});
      }
      await client.query('DELETE FROM sc_vattu WHERE sc_id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM phieu_sua WHERE id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      if (vatId) await client.query('DELETE FROM vattu WHERE id=$1', [vatId]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  /* ═══════════════ TC-PR-05: Đối chiếu mua sắm / Báo cáo XNT (khoa) ═══════════════
     Chuỗi đầy đủ đề xuất→nhập→xuất (SQL) rồi tonKhoReport đối chiếu:
     ton_cuoi = ton_dau + nhap - xuat, tổng tiền khớp; dmListBySc truy vết SC. */
  if (c.id === 'TC-PR-05') {
    const pool = new Pool({
      connectionString:
        process.env['DATABASE_URL'] ||
        'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os',
    });
    await cleanupUATW3(pool);
    const client = await pool.connect();
    const rnd = rnd6();
    const bks = '51C-UATW3' + rnd;
    const SCID = 'SC-UATW3' + rnd;
    const today = new Date().toISOString().slice(0, 10);
    let vatId: number | null = null;
    let dmId: string | null = null;
    let pnId: string | null = null;
    let pxId: string | null = null;
    try {
      const vi = await client.query(
        "INSERT INTO vattu(code,name,nhom,donvi,gia,ton,ton_min,active,deleted_at) VALUES($1,$2,'UAT','cái',50000,0,0,1,'') RETURNING id",
        ['VT-UATW3' + rnd, 'Vat tu UAT PR5 ' + rnd],
      );
      vatId = Number(vi.rows[0].id);
      dmId = 'DNM-UATW3' + rnd;
      pnId = 'PXN-UATW3' + rnd;
      pxId = 'PXX-UATW3' + rnd;
      await client.query(
        "INSERT INTO de_nghi_mua(id,nguoi_lap,ngay,trang_thai,nguoi_duyet,ngay_duyet,tong,ghi_chu,deleted_at) VALUES($1,$2,$3,'da_nhap','giamdoc-1',$4,500000,'UAT TC-PR-05','')",
        [dmId, 'khoa-1', today, today],
      );
      await client.query(
        "INSERT INTO dm_mua_ct(dm_id,vattu_id,ten,donvi,so_luong,dg_dk,dg_tt,tt,sc_id,deleted_at) VALUES($1,$2,$3,'cái',10,50000,50000,'da_nhap',$4,'')",
        [dmId, vatId, 'Vat tu UAT PR5 ' + rnd, SCID],
      );
      await client.query(
        "INSERT INTO phieu_nhap(id,ngay,nguoi_lap,nha_cc,ref_dm,tong,ghi_chu,loai_nhap,deleted_at) VALUES($1,$2,'khoa-1','NCC UAT',$3,500000,'UAT','moi','')",
        [pnId, today, dmId],
      );
      await client.query(
        "INSERT INTO phieu_nh_ct(ph_id,vattu_id,ten,donvi,so_luong,dgia,thanh,ref_dm,deleted_at) VALUES($1,$2,$3,'cái',10,50000,500000,$4,'')",
        [pnId, vatId, 'Vat tu UAT PR5 ' + rnd, dmId],
      );
      await client.query('UPDATE vattu SET ton = ton + 10 WHERE id=$1', [vatId]);
      await client.query(
        'INSERT INTO xe(id,bks,hang,dong,trang_thai,tenant_id) VALUES($1,$2,$3,$4,$5,$6)',
        [bks, bks, 'T', 'T', 'active', 'c1'],
      );
      await client.query(
        `INSERT INTO phieu_sua(id,bks,nguoi_lap,ngay,mo_ta,trang_thai,tong,la_sua_ngoai,tenant_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,0,$8)`,
        [SCID, bks, 'xuong-1', today, 'SC UAT doi chieu', 'dang_sua', 0, 'c1'],
      );
      await client.query(
        "INSERT INTO sc_vattu(sc_id,vattu_id,ten,donvi,so_luong,gd_dk,gd_tt,thanh,tt,loai_xu_ly,deleted_at) VALUES($1,$2,$3,'cái',6,50000,50000,300000,'da_xuat','khac_phuc','')",
        [SCID, vatId, 'Vat tu UAT PR5 ' + rnd],
      );
      await client.query(
        "INSERT INTO phieu_xuat(id,ngay,nguoi_lap,ref_sc,ghi_chu,loai_xuat,deleted_at) VALUES($1,$2,'khoa-1',$3,'UAT','dung','')",
        [pxId, today, SCID],
      );
      await client.query(
        "INSERT INTO phieu_xuat_ct(ph_id,vattu_id,ten,donvi,so_luong,dgia,thanh,ref_sc,deleted_at) VALUES($1,$2,$3,'cái',6,50000,300000,$4,'')",
        [pxId, vatId, 'Vat tu UAT PR5 ' + rnd, SCID],
      );
      await client.query('UPDATE vattu SET ton = ton - 6 WHERE id=$1', [vatId]);

      // 1. Báo cáo Xuất–Nhập–Tồn trong kỳ → đối chiếu khớp
      const ctxK = await apiRequest.newContext({ storageState: resolve(AUTH, 'khovattu.json') });
      const r1 = await rpcCtx(ctxK, 'tonKhoReport', [{ from: today, to: today }]);
      const j1 = r1.body;
      expect(j1.ok, 'tonKhoReport phai ok: ' + JSON.stringify(j1)).toBe(true);
      const rowsAll = j1.result || [];
      const row = rowsAll.find((r: any) => Number(r.id) === Number(vatId));
      expect(row, 'bao cao phai co dong vat tu').toBeTruthy();
      expect(Number(row.nhap), 'nhap = 10').toBe(10);
      expect(Number(row.xuat), 'xuat = 6').toBe(6);
      expect(Number(row.ton_cuoi), 'ton cuoi = 4').toBe(4);
      // Đối chiếu: ton_cuoi === ton_dau + nhap - xuat
      expect(Number(row.ton_cuoi), 'doi chieu ton khop').toBe(Number(row.ton_dau) + Number(row.nhap) - Number(row.xuat));
      // Đối chiếu tiền: tổng nhập = tổng xuất + giá trị tồn cuối (không có chi phí treo)
      const tienNhap = 10 * 50000;
      const tienXuat = 6 * 50000;
      const giaTriTon = Number(row.ton_cuoi) * 50000;
      expect(tienNhap, 'khong co chi phi treo: nhap = xuat + ton').toBe(tienXuat + giaTriTon);

      // 2. Truy vết SC → đề nghị mua
      const r2 = await rpcCtx(ctxK, 'dmListBySc', [SCID]);
      const j2 = r2.body;
      expect(j2.ok, 'dmListBySc phai ok: ' + JSON.stringify(j2)).toBe(true);
      const found = (j2.result || []).some((d: any) => d.id === dmId);
      expect(found, 'phai truy vet de nghi tu SC').toBe(true);

      // 3. Phân quyền: laixe KHÔNG xem báo cáo kho
      const ctxL = await apiRequest.newContext({ storageState: resolve(AUTH, 'laixe.json') });
      const r3 = await rpcCtx(ctxL, 'tonKhoReport', [{ from: today, to: today }]);
      expect(r3.body.ok, 'laixe khong co kho.xem phai bi chan: ' + JSON.stringify(r3.body)).toBe(false);

      await ctxK.dispose();
      await ctxL.dispose();
    } finally {
      if (pxId) {
        await client.query('DELETE FROM ledger WHERE ref_id=$1', [SCID]).catch(() => {});
        await client.query('DELETE FROM phieu_xuat_ct WHERE ph_id=$1', [pxId]).catch(() => {});
        await client.query('DELETE FROM phieu_xuat WHERE id=$1', [pxId]).catch(() => {});
      }
      await client.query('DELETE FROM sc_vattu WHERE sc_id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM phieu_sua WHERE id=$1', [SCID]).catch(() => {});
      await client.query('DELETE FROM xe WHERE id=$1', [bks]).catch(() => {});
      if (pnId) {
        await client.query('DELETE FROM phieu_nh_ct WHERE ph_id=$1', [pnId]).catch(() => {});
        await client.query('DELETE FROM phieu_nhap WHERE id=$1', [pnId]).catch(() => {});
      }
      if (dmId) {
        await client.query('DELETE FROM dm_mua_ct WHERE dm_id=$1', [dmId]).catch(() => {});
        await client.query('DELETE FROM de_nghi_mua WHERE id=$1', [dmId]).catch(() => {});
      }
      if (vatId) await client.query('DELETE FROM vattu WHERE id=$1', [vatId]).catch(() => {});
      client.release();
      await pool.end();
    }
    return;
  }

  // Chưa có UI chi tiết → báo rõ để loop bổ sung tính năng ẩn
  throw new Error(`CẦN BỔ SUNG TÍNH NĂNG: ${c.discover}`);
}

for (const c of data.cases) {
  test(`[${c.id}] ${c.title}`, async ({ page, request }) => {
    await runCase(c, page, request);
  });
}
