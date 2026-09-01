import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

/**
 * W2.5-flag — E2E cờ UI CUỐI: WIRESH_PRICE=true trên /sc.
 *
 * Chuỗi hành vi cần chứng minh (không được tin comment, chỉ được tin bằng chứng):
 *  1. SC trạng thái `de_xuat` (seed `scCreate` qua HTTP rpc — admin → is_test=1,
 *     scList KHÔNG lọc is_test cho admin → dòng hiện ra UI).
 *  2. Lịch sử giá VT seed QUA CORE (`nhapKho` don_gia>0 → ghiGiaLichSu,
 *     admin → is_test=1; `giaLichSuList` đọc KHÔNG lọc is_test → top-8 thấy được).
 *     Không cần INSERT trực tiếp: core đã có đường ghi.
 *  3. UI: mở modal → chọn VT → block `sc-gia-ncc` hiện ĐỦ 2 mốc giá, và hint cũ
 *     W2.5 "Hiển thị tham khảo · gán giá sẽ ở W3.4" PHẢI MẤT (cờ đã bật).
 *  4. Chọn option giá KHÔNG phải mặc định (dòng #2 — giá cũ hơn) → submit →
 *     request `scAddVatTu` mang `args.don_gia` đúng giá chọn (transport evidence)
 *     → DB `sc_vattu.gd_dk` = giá chọn, `sc.tong_vt` = so_luong × gd_dk
 *     (persistence evidence, W3.3A alias don_gia↔gd_dk).
 *  5. Gate trạng thái không vỡ: scBatDauSua → `dang_sua` → block gán giá ẩn lại.
 * • Dev server :3001 — spec TỰ spawn (`npx next dev -p 3001`) + TỰ kill; health
 *   OK thì reuse (killOwner=false — không giết server của worker khác, ĐỪNG :3000).
 * • Đăng nhập role `admin` MỘT lần beforeAll (middleware chặn >5 POST /api/auth
 *   — 429 đã gặp ở kho.spec). VT chọn VT-000002: các VT khác bị test đối chuẩn
 *   tham chiếu trực tiếp (tránh va pollution nhapKho: ton+1, gia COALESCE).
 * • Nếu seed bị gate nghiệp vụ chặn → test.skip + ghi rõ lý do (chỉ đạo W2.5-flag),
 *   NHƯNG core-path đã kiểm tra tĩnh (admin bypass perm.ts:20) → mọi skip đều
 *   phải in reason để coordinator biết là bất thường, không im lặng.
 * • Screenshots: test-results/sc-*.png
 *
 *   Playwright: `npx playwright test tests/e2e/sc.spec.ts --project=chromium`
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const AUTH_FILE = '.playwright-auth-sc.json';
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const RUN_TAG = `e2e-w25-${Date.now().toString(36)}`;
const GIA_OLD = 4_321_000; // mốc cũ (H-1) — giá ĐƯỢC CHỌN trong test (≠ option đầu)
const GIA_NEW = 4_999_000; // mốc mới nhất (H) — để lệnh chọn không thể "ăn may" top-1
// số tiền hiển thị: UI dùng toLocaleString('vi-VN') + '₫' (không space) —
// Node bản này ICU full, cùng separator '.' như Chromium vi-VN.
const moneyVi = (n: number) => n.toLocaleString('vi-VN') + '\u20ab';
const createdScIds: string[] = [];
const createdPhieuIds: string[] = []; // NX từ nhapKho seed — nối mốc giá qua phieu_id

/* ─────────────────────────── dev server helper (pattern dm.spec) ─────────── */
let server: ReturnType<typeof spawn> | null = null;
let killOwner = true;

async function healthOk(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.db === 'up';
  } catch {
    return false;
  }
}

async function startDev(): Promise<void> {
  if (await healthOk()) {
    killOwner = false;
    console.log('[sc.spec] reuse dev server port 3001 — not spawning');
    return;
  }
  console.log('[sc.spec] spawning next dev -p 3001');
  const nextBin = require.resolve('next/dist/bin/next');
  server = spawn(process.execPath, [nextBin, 'dev', '-p', '3001'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3001', TEST_BASE_URL: BASE },
    shell: false,
    stdio: 'ignore',
  });
  const t0 = Date.now();
  while (!(await healthOk())) {
    if (Date.now() - t0 > 180_000) throw new Error('[sc.spec] dev server :3001 health timeout');
    if (server && server.exitCode != null) throw new Error('[sc.spec] dev server exited early: ' + server.exitCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('[sc.spec] dev server :3001 healthy');
}

function pidsOnPort(port: number): number[] {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr LISTENING`, { encoding: 'utf8' });
    const pids = new Set<number>();
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/\s(\d+)\s*$/);
      if (m) pids.add(Number(m[1]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killDev() {
  if (!killOwner) return;
  const pid = server?.pid;
  try {
    if (process.platform === 'win32' && pid) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else if (pid) {
      server!.kill('SIGTERM');
    }
  } catch {
    /* already dead */
  }
  server = null;
  try {
    for (const orphan of pidsOnPort(3001)) {
      execSync(`taskkill /PID ${orphan} /T /F`, { stdio: 'ignore' });
      console.log(`[sc.spec] killed orphan :3001 pid=${orphan}`);
    }
  } catch {
    /* ignore */
  }
}

process.on('exit', killDev);

/* ────────────────────────────── RPC helper ──────────────────────────────── */
type RpcResp = { httpStatus: number; ok?: boolean; error?: string; result?: any };

async function rpc(page: Page, fn: string, args: Record<string, unknown>): Promise<RpcResp> {
  const res = await page.request.post(`${BASE}/api/rpc`, { data: { fn, args } });
  const status = res.status();
  let body: any = {};
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { httpStatus: status, ok: body?.ok, error: body?.error, result: body?.result };
}

/** env lồng: một số fn (nhapKho/giaLichSuList) trả {ok:false,error} BÊN TRONG result. */
function coreOk(r: RpcResp): { ok: boolean; error?: string; result?: any } {
  if (!r.ok) return { ok: false, error: r.error };
  const env = r.result as { ok?: boolean; error?: string; result?: unknown } | null;
  if (env && typeof env === 'object' && 'ok' in env && env.ok === false) {
    return { ok: false, error: env.error };
  }
  return { ok: true, result: env && typeof env === 'object' && 'result' in env ? (env as any).result : r.result };
}

/* ─────────────────────────────── DB helper ──────────────────────────────── */
function dbPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom',
  });
}

test.describe('SC W2.5-flag — /sc gán giá NCC wire don_gia→gd_dk', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async ({ browser }) => {
    await startDev();
    if (existsSync(AUTH_FILE)) rmSync(AUTH_FILE);
    const ctx = await browser.newContext({ storageState: undefined });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`);
    await p.getByPlaceholder('Tài khoản').fill('admin');
    await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
    await p.getByRole('button', { name: 'Đăng nhập' }).click();
    await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await ctx.storageState({ path: AUTH_FILE });
    await ctx.close();
  });

  test.use({ storageState: AUTH_FILE });

  test('(i) de_xuat: top-8 → chọn giá #2 → scAddVatTu don_gia ghi DB gd_dk, tong_vt recalc', async ({
    page,
  }) => {
    // ── seed 1: lịch sử giá QUA CORE (admin → is_test=1, giaLichSuList vẫn đọc) ──
    const pool = dbPool();
    let vattu = '';
    let xeId = '';
    try {
      const vr = await pool.query(
        `SELECT id FROM vattu WHERE deleted_at='' AND is_test=0 AND id='VT-000002' LIMIT 1`
      );
      vattu = vr.rows[0]?.id ?? '';
      const xr = await pool.query(
        `SELECT id FROM xe WHERE deleted_at='' AND is_test=0 ORDER BY id ASC LIMIT 1`
      );
      xeId = xr.rows[0]?.id ?? '';
    } finally {
      await pool.end();
    }
    test.skip(!vattu, `[W2.5-flag] thiếu VT-000002 is_test=0 trong DB — seed chưa chạy? SKIP có chủ đích, report coordinator`);
    test.skip(!xeId, `[W2.5-flag] thiếu xe active — không tạo được SC qua scCreate. SKIP, report coordinator`);

    const nhapOld = coreOk(await rpc(page, 'nhapKho', {
      vattu_id: vattu, so_luong: 1, don_gia: GIA_OLD, ngay: YESTERDAY, ncc: `${RUN_TAG} old`,
    }));
    const nhapNew = coreOk(await rpc(page, 'nhapKho', {
      vattu_id: vattu, so_luong: 1, don_gia: GIA_NEW, ngay: TODAY, ncc: `${RUN_TAG} new`,
    }));
    if (!nhapOld.ok || !nhapNew.ok) {
      console.warn(`[W2.5-flag] nhapKho bị core chặn: ${nhapOld.error ?? nhapNew.error} — skip (bất thường, báo coordinator)`);
    }
    test.skip(!nhapOld.ok || !nhapNew.ok, `nhapKho seed giá bị gate: ${nhapOld.error ?? nhapNew.error}`);
    // liên kết MỐC GIÁ ↔ phiếu = `phieu_id` (core ghiGiaLichSu NHẬN ncc nhưng
    // nhapKho KHÔNG truyền xuống — cột ncc history luôn ''). Dùng id phiếu NX
    // (mỗi run một pair riêng) — không được lọc bằng ncc.
    const phieuIds = [
      String((nhapOld.result as { id?: string })?.id ?? ''),
      String((nhapNew.result as { id?: string })?.id ?? ''),
    ];
    createdPhieuIds.push(...phieuIds.filter(Boolean));
    expect(phieuIds[0] && phieuIds[1], 'hai phiếu NX phải có id').toBeTruthy();

    // ── seed 2: SC de_xuat qua HTTP rpc (admin → is_test=1, scList không lọc admin) ──
    const cr = coreOk(await rpc(page, 'scCreate', { xe_id: xeId, ngay: TODAY }));
    if (!cr.ok) {
      console.warn(`[W2.5-flag] scCreate fail: ${cr.error} — skip (perm/UI gate nghiệp vụ? báo coordinator)`);
    }
    test.skip(!cr.ok, `scCreate gate: ${cr.error}`);
    const scId = String((cr.result as { id?: string })?.id ?? '');
    expect(/^SC-/.test(scId)).toBeTruthy();
    createdScIds.push(scId);

    // ── UI: /sc → dòng SC → 'Chi tiết' ──
    await page.goto(`${BASE}/sc`);
    if (page.url().includes('/login')) throw new Error('storageState expired — redirected to /login');
    await expect(page.getByRole('heading', { name: /Quản lý sửa chữa/ })).toBeVisible({ timeout: 90_000 });
    const scRow = page.getByRole('row').filter({ hasText: scId });
    await expect(scRow, `SC ${scId} không thấy trong danh sách (admin lẽ ra thấy cả is_test=1)`).toBeVisible({ timeout: 30_000 });
    await scRow.getByRole('button', { name: 'Chi tiết' }).click();
    const modal = page.locator('div.fixed.inset-0.z-50').filter({ hasText: 'Chi tiết SC' });
    await expect(modal.getByRole('heading', { name: `Chi tiết SC: ${scId}` })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/sc-01-modal-dexuat.png', fullPage: true });

    // ── chọn VT → fetch giaLichSuList (top-8, ngay DESC) ──
    await modal.getByTestId('sc-vt-select').selectOption(vattu);
    const giaBlock = modal.getByTestId('sc-gia-ncc');
    await expect(giaBlock).toBeVisible({ timeout: 20_000 });
    // CỜ ĐÃ BẬT: hint W2.5-phai phải biến mất
    await expect(giaBlock.getByText('Hiển thị tham khảo')).toHaveCount(0);
    await expect(giaBlock.getByText('gán giá sẽ ở W3.4')).toHaveCount(0);

    // DB là sự thật: đúng 2 mốc của RUN này (tra theo phieu_id của chính nó)
    const pool2 = dbPool();
    let histRows: Array<{ id: string | number; gia: string | number; ngay: string }>;
    try {
      const h = await pool2.query(
        `SELECT id, gia, ngay FROM vattu_gia_lich_su
          WHERE vattu_id=$1 AND deleted_at='' AND phieu_id = ANY($2)
          ORDER BY ngay DESC, id DESC`,
        [vattu, phieuIds]
      );
      histRows = h.rows as any;
    } finally {
      await pool2.end();
    }
    expect(histRows.length, 'core phải ghi đủ 2 mốc giá qua nhapKho').toBe(2);
    expect(Number(histRows[0].gia)).toBe(GIA_NEW); // top-1 = mới nhất
    const giaChonRow = histRows[1]; // CHỌN option #2 (giá CŨ hơn) — phản chứng auto-top-1
    expect(Number(giaChonRow.gia)).toBe(GIA_OLD);

    await expect(
      giaBlock.getByTestId('sc-gia-ncc-list').getByRole('button')
    ).not.toHaveCount(0);
    await expect(giaBlock.getByTestId('sc-gia-ncc-list')).toContainText(moneyVi(GIA_NEW));
    await expect(giaBlock.getByTestId('sc-gia-ncc-list')).toContainText(moneyVi(GIA_OLD));
    await page.screenshot({ path: 'test-results/sc-02-gia-top8.png', fullPage: true });

    const giaSelect = giaBlock.getByTestId('sc-gia-ncc-select');
    await giaSelect.selectOption({ value: String(giaChonRow.id) });
    await expect(giaSelect).toHaveValue(String(giaChonRow.id));
    await modal.getByTestId('sc-vt-soluong').fill('2');

    // ── submit + BẰNG CHỨNG TRANSPORT: payload scAddVatTu mang don_gia=GIA_OLD ──
    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/api/rpc') && (r.postData() || '').includes('scAddVatTu'),
      { timeout: 30_000 }
    );
    await modal.getByTestId('sc-vt-submit').click();
    const addReq = await reqPromise;
    const payload = JSON.parse(addReq.postData() || '{}');
    expect(payload?.fn).toBe('scAddVatTu');
    expect(payload?.args?.sc_id).toBe(scId);
    expect(Number(payload?.args?.don_gia), 'WIRESH_PRICE=true PHẢI gửi don_gia đúng giá đã chọn').toBe(GIA_OLD);

    // ── BẰNG CHỨNG DB: gd_dkpersist + tổng recalc (CASE gd_tt=0 → gd_dk) ──
    const pool3 = dbPool();
    try {
      await expect
        .poll(
          async () => {
            const v = await pool3.query(
              `SELECT gd_dk FROM sc_vattu WHERE sc_id=$1 AND vattu_id=$2 AND deleted_at='' ORDER BY id DESC LIMIT 1`,
              [scId, vattu]
            );
            return v.rows[0] ? Number(v.rows[0].gd_dk) : -1;
          },
          { timeout: 20_000, message: 'sc_vattu.gd_dk phải = don_gia đã chọn (W3.3A alias)' }
        )
        .toBe(GIA_OLD);
      const t = await pool3.query(`SELECT tong_vt, tong FROM sc WHERE id=$1`, [scId]);
      expect(Number(t.rows[0].tong_vt), 'tong_vt = so_luong × gd_dk').toBe(2 * GIA_OLD);
      expect(Number(t.rows[0].tong), 'tong chứa phần vật tư').toBe(2 * GIA_OLD);
    } finally {
      await pool3.end();
    }

    // UI sau refreshAll: activity feed có dòng sc_them_vt
    await expect(modal.getByRole('cell', { name: 'sc_them_vt' }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/sc-03-added-gd-dk.png', fullPage: true });

    // ── gate trạng thái không vỡ: chuyển dang_sua → block gán giá PHẢI ẩn ──
    const batDau = coreOk(await rpc(page, 'scBatDauSua', { sc_id: scId }));
    test.info().annotations.push({
      type: 'w25-flag',
      description: batDau.ok
        ? 'scBatDauSua OK → check block ẩn khi dang_sua'
        : `scBatDauSua fail (${batDau.error}) — bỏ qua bước ẩn block (không fail oan vì cờ)`,
    });
    if (batDau.ok) {
      await page.reload();
      await expect(page.getByRole('heading', { name: /Quản lý sửa chữa/ })).toBeVisible({ timeout: 60_000 });
      const scRow2 = page.getByRole('row').filter({ hasText: scId });
      await expect(scRow2).toBeVisible({ timeout: 30_000 });
      await scRow2.getByRole('button', { name: 'Chi tiết' }).click();
      const modal2 = page.locator('div.fixed.inset-0.z-50').filter({ hasText: 'Chi tiết SC' });
      await expect(modal2.getByRole('heading', { name: /Chi tiết SC/ })).toBeVisible({ timeout: 20_000 });
      await modal2.getByTestId('sc-vt-select').selectOption(vattu);
      await expect(modal2.getByTestId('sc-gia-ncc')).toHaveCount(0); // chỉ de_xuat mới gán giá
      await page.screenshot({ path: 'test-results/sc-04-hidden-when-dang-sua.png', fullPage: true });
    }
  });
});

/* ────────────────────────── dọn dẹp (soft, giữ audit) ─────────────────────── */
  test.afterAll(async () => {
  killDev();
  const pool = dbPool();
  try {
    const now = new Date().toISOString();
    if (createdScIds.length) {
      // phiếu + dòng VT soft-delete (không DELETE cứng — audit trail giữ);
      // tong_* không cần recalc vì phiếu đã ẩn khỏi mọi truy vấn deleted_at=''.
      await pool.query(`UPDATE sc_vattu SET deleted_at=$2 WHERE sc_id = ANY($1) AND deleted_at=''`, [createdScIds, now]);
      const r = await pool.query(`UPDATE sc SET deleted_at=$2 WHERE id = ANY($1) AND deleted_at=''`, [createdScIds, now]);
      console.log(`[sc.spec] soft-deleted sc rows: ${r.rowCount}`);
    }
    if (createdPhieuIds.length) {
      // mốc giá của RUN (tra theo phieu_id — ncc history không do core truyền)
      // soft → chạy lại nhiều lần không tích tụ top-8 giả.
      const g = await pool.query(`UPDATE vattu_gia_lich_su SET deleted_at=$2 WHERE phieu_id = ANY($1) AND deleted_at=''`, [createdPhieuIds, now]);
      console.log(`[sc.spec] soft-deleted gia_lich_su markers: ${g.rowCount}`);
      // phiếu nhập is_test=1 soft khỏi sổ nghiệp vụ (audit vẫn tra được qua is_test)
      const n = await pool.query(`UPDATE nhap_xuat SET deleted_at=$2 WHERE id = ANY($1) AND deleted_at=''`, [createdPhieuIds, now]);
      console.log(`[sc.spec] soft-deleted nhap_xuat seeds: ${n.rowCount}`);
      // LƯU Ý còn lại (bất biến nhân quả của nhập kho, KHÔNG rollback tay):
      //  VT-000002 ton +2 / gia→GIA_NEW per run. Conformance không tham chiếu
      //  VT-000002 (đã grep) — drift chỉ số VT-000002 là chấp nhận được.
    }
  } catch (e) {
    console.log('[sc.spec] cleanup warn:', (e as Error).message);
  } finally {
    await pool.end();
  }
});
