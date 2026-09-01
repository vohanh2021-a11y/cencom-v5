import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

/**
 * W2.5+W2.6 — E2E trang MUA SẮM (/kho/dm) + DM flow.
 *
 * • Dev server :3001 — spec TỰ spawn (`npx next dev -p 3001`) và TỰ kill sau
 *   suite (ĐỪNG dùng :3000 — worker-c đang chiếm). Nếu port đã có server health
 *   OK sẽ reuse (đánh dấu kill=false để không giết tiến trình không phải mình mở).
 * • storageState đăng nhập role `kho` MỘT lần trong beforeAll (middleware chặn
 *   >5 POST /api/auth/5ph → login-lặp sinh 429, đã gặp ở kho.spec).
 * • RPC đi theo TÊN fn: `dmCreate` (chưa worker nào tranh) + probe `dmDecide`
 *   theo contract W2b (chưa chắc đã đăng ký lúc chạy song song): nếu fn chưa
 *   khả dụng (HTTP 404 'Unknown fn') → test.skip(), KHÔNG fail oan. Quyền thật
 *   do server enforce (UI gating chỉ là hint).
 * • Screenshots: test-results/dm-*.png
 *
 *   Playwright: `npx playwright test tests/e2e/dm.spec.ts --project=chromium`
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const AUTH_FILE = '.playwright-auth-dm.json';
const TODAY = new Date().toISOString().slice(0, 10);
const createdDmIds: string[] = [];

/* ─────────────────────────── dev server helper ─────────────────────────── */
let server: ReturnType<typeof spawn> | null = null;
let killOwner = true; // mình spawn → mình kill

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
    killOwner = false; // reuse — server đã chạy → KHÔNG kill (tránh giết của người khác)
    console.log('[dm.spec] reuse dev server port 3001 — not spawning');
    return;
  }
  console.log('[dm.spec] spawning next dev -p 3001');
  // Pattern scripts/run-e2e.mjs: gọi THẲNG node + cli.js của next (KHÔNG
  // shell) → PID là chính next (không phải cmd wrapper) → kill chính xác +
  // hết cảnh báo DEP0190. cwd = repo root (playwright chạy từ project root).
  const nextBin = require.resolve('next/dist/bin/next');
  server = spawn(process.execPath, [nextBin, 'dev', '-p', '3001'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3001', TEST_BASE_URL: BASE },
    shell: false,
    stdio: 'ignore', // logs dev → /dev/null; reporter Playwright giữ sạch stdout
  });
  const t0 = Date.now();
  while (!(await healthOk())) {
    if (Date.now() - t0 > 180_000) throw new Error('[dm.spec] dev server :3001 health timeout');
    if (server && server.exitCode != null) throw new Error('[dm.spec] dev server exited early: ' + server.exitCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('[dm.spec] dev server :3001 healthy');
}

/** Parse `netstat -ano` tìm PID LISTEN trên port (project-specific port). */
function pidsOnPort(port: number): number[] {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} " | findstr LISTENING`, {
      encoding: 'utf8',
    });
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
  // 1) kill tiến trình mình spawn (+tree nếu còn)
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
  // 2) fallback: port vẫn có listener = con đểnh của CHÍNH spec này spawn
  //    (phòng wrapper/shell giữ node mồ côi) → diệt theo port; ĐỪNG đụng :3000.
  try {
    for (const orphan of pidsOnPort(3001)) {
      execSync(`taskkill /PID ${orphan} /T /F`, { stdio: 'ignore' });
      console.log(`[dm.spec] killed orphan :3001 pid=${orphan}`);
    }
  } catch {
    /* ignore */
  }
}

// Chốt cuối dự phòng nếu afterAll không chạy được (worker crash)
process.on('exit', killDev);

/* ───────────────────────────── RPC helper ──────────────────────────────── */
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

async function gotoDm(page: Page) {
  await page.goto(`${BASE}/kho/dm`);
  if (page.url().includes('/login')) throw new Error('storageState expired — redirected to /login');
  await expect(page.getByRole('heading', { name: /Mua/ })).toBeVisible({ timeout: 90_000 });
}

/** Login role khác (mở rộng test phân quyền). middleware chặn >5 POST
 *  /api.auth/5ph — suite này chỉ dùng 2-3 lần; nếu bị 429 → caller skip. */
async function loginContext(browser: import('@playwright/test').Browser, user: string) {
  const ctx = await browser.newContext({ storageState: undefined });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.getByPlaceholder('Tài khoản').fill(user);
  await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
  await p.getByRole('button', { name: 'Đăng nhập' }).click();
  try {
    await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  } catch {
    const body = await p.locator('body').innerText().catch(() => '');
    await ctx.close();
    throw new Error(`login ${user} fail (rate-limit?): ${body.slice(0, 140)}`);
  }
  return ctx;
}

/* ─────────────────────────────── DB helper ─────────────────────────────── */
function dbPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom',
  });
}

test.describe('Mua sắm W2.6 — /kho/dm', () => {
  test.describe.configure({ timeout: 180_000 }); // dev compile + spawn health

  test.beforeAll(async ({ browser }) => {
    await startDev();
    if (existsSync(AUTH_FILE)) rmSync(AUTH_FILE);
    const ctx = await browser.newContext({ storageState: undefined });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`);
    await p.getByPlaceholder('Tài khoản').fill('kho');
    await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
    await p.getByRole('button', { name: 'Đăng nhập' }).click();
    await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await ctx.storageState({ path: AUTH_FILE });
    await ctx.close();
  });

  test.use({ storageState: AUTH_FILE });

  test('(i) dmList load + filter switch (chips) không lỗi', async ({ page }) => {
    await gotoDm(page);

    // header load qua dmList — tbody/tab phải hiện
    await expect(page.getByTestId('dm-tabs')).toBeVisible();
    await expect(page.getByTestId('dm-list-section')).toBeVisible();
    await page.screenshot({ path: 'test-results/dm-01-list.png', fullPage: true });

    // probe fn dmDecide → badge khả dụng/chưa KHÔNG được crash trang
    const badge = page.getByTestId('dm-decide-avail');
    await expect(badge).toBeVisible({ timeout: 30_000 });

    // Chuyển từng chip trạng thái — không lỗi server (banner lỗi phải ẩn)
    for (const id of ['dm-chip-cho_duyet', 'dm-chip-da_nhap', 'dm-chip-tu_choi', 'dm-chip-tat']) {
      await page.getByTestId(id).click();
      await expect(page.getByTestId('dm-list-section')).toBeVisible();
      await expect(page.getByTestId('dm-list-section')).toContainText('Mã DM', { timeout: 30_000 });
    }

    // Sang tab 'DM từ SC' rồi quay lại — render ổn định
    await page.getByTestId('dm-tab-tu_sc').click();
    await expect(page.getByTestId('dm-sc-find')).toBeVisible();
    await page.getByTestId('dm-tab-danh_sach').click();
    await expect(page.getByTestId('dm-chip-tat')).toBeVisible();
  });

  test('(ii) dmCreate qua rpc → dmList thấy dòng + expand hiện items', async ({ page }) => {
    await gotoDm(page);

    // Lấy 1 vattu_id tất định từ DB (kho role chỉ thấy is_test=0 đã xoá-empty)
    const pool = dbPool();
    let vattu = '';
    let vattuTen = '';
    try {
      const vr = await pool.query(
        `SELECT id, ten FROM vattu WHERE deleted_at='' AND is_test=0 ORDER BY id ASC LIMIT 1`
      );
      if (!vr.rows[0]) throw new Error('DB thiếu vattu active — seed chưa chạy?');
      vattu = vr.rows[0].id;
      vattuTen = vr.rows[0].ten;
    } finally {
      await pool.end();
    }

    // Tạo DM qua đúng contract rpc {fn,args} (envelope 2 lớp → core {id})
    const cr = await rpc(page, 'dmCreate', {
      ngay: TODAY,
      items: [{ vattu_id: vattu, so_luong: 5, don_gia: 55000 }],
    });
    expect(cr.ok, `dmCreate: ${cr.error}`).toBe(true);
    const dmId = String((cr.result as { id?: string })?.id ?? '');
    expect(/^DM-/.test(dmId)).toBeTruthy();
    createdDmIds.push(dmId);

    await page.reload();
    const row = page.getByTestId('dm-row').filter({ hasText: dmId });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByTestId('dm-expand').click();

    // dmDetail: items grid có đúng 1 dòng vattu (ten JOIN từ dmDetail)
    const detailRow = page.getByTestId('dm-detail-row');
    await expect(detailRow).toBeVisible({ timeout: 20_000 });
    await expect(detailRow.getByTestId('dm-item')).toHaveCount(1);
    await expect(detailRow.getByTestId('dm-item')).toContainText(String(vattuTen).slice(0, 12));

    await page.screenshot({ path: 'test-results/dm-02-created-expand.png', fullPage: true });

    // Nút Xóa (dmDelete) hiện khi cho_duyet + role kho (dmDelete ['kho','sua'])
    await expect(row.getByTestId('dm-delete')).toBeVisible();

    // dmListBySc (tab DM từ SC) — dùng 1 dm có sc_id nếu khả dụng, không bắt buộc
    // (không tự tạo SC ở đây — tránh phụ thuộc W2/W3)
  });

  test('(iii) dmDecide: probe → availability=false skip; else duyệt/từ chối đúng role', async ({
    page,
    browser,
  }) => {
    await gotoDm(page);

    // ── PROBE theo TÊN fn (worker-c W2b đăng ký song song qua rpc.ts) ──
    // fn CHƯA ở registry → dispatch 'Unknown fn' → HTTP 404.
    // fn ĐÃ registry → core validate id (HTTP 200, {ok:true,result:{ok:false,…}}).
    const probe = await rpc(page, 'dmDecide', { id: 'DM-000000', quyet: 'duyet' });
    const errLc = (probe.error || '').toLowerCase();
    test.skip(
      probe.httpStatus === 404 || errLc.includes('unknown fn') || errLc.includes('fn chưa khả dụng'),
      'dmDecide chưa đăng ký RPC (W2b worker-c đang song song) → skip duyệt'
    );

    // ── chuẩn bị 2 DM 'cho_duyet' bằng role kho (is_test=0 → lọt dmList) ──
    const pool = dbPool();
    let vattu = '';
    try {
      const vr = await pool.query(`SELECT id FROM vattu WHERE deleted_at='' AND is_test=0 ORDER BY id ASC LIMIT 1`);
      vattu = vr.rows[0]?.id ?? '';
    } finally {
      await pool.end();
    }
    test.skip(!vattu, 'không có vattu seed cho test duyệt');

    const mkDm = async () => {
      const cr = await rpc(page, 'dmCreate', {
        ngay: TODAY,
        items: [{ vattu_id: vattu, so_luong: 2, don_gia: 1000 }],
      });
      expect(cr.ok, `dmCreate: ${cr.error}`).toBe(true);
      const dmId = String((cr.result as { id?: string })?.id ?? '');
      createdDmIds.push(dmId);
      return dmId;
    };
    const dmDuyet = await mkDm();
    const dmTuChoi = await mkDm();

    // UI hint: role kho KHÔNG có mua.duy → nút Duyệt/Từ chối phải ẨN (core
    // mới là phán quyết thật — UI không được cho bấm rồi nhận lỗi lạ).
    await page.reload();
    const rowKho = page.getByTestId('dm-row').filter({ hasText: dmDuyet });
    await expect(rowKho).toBeVisible({ timeout: 30_000 });
    await expect(rowKho.getByTestId('dm-approve')).toHaveCount(0);
    await expect(rowKho.getByTestId('dm-reject')).toHaveCount(0);
    // trạng thái hiển thị qua CHIP (dm-tt), không match theo label nút
    await expect(rowKho.getByTestId('dm-tt')).toHaveText('Chờ duyệt');

    // ── mở phiên giamdoc (role DUYỆT hợp lệ theo core W2b) ──
    let ctxGiamdoc;
    try {
      ctxGiamdoc = await loginContext(browser, 'giamdoc');
    } catch (e) {
      test.skip(true, (e as Error).message);
      return;
    }
    try {
      const gp = await ctxGiamdoc.newPage();
      await gp.goto(`${BASE}/kho/dm`);
      await expect(gp.getByRole('heading', { name: /Mua/ })).toBeVisible({ timeout: 60_000 });

      // DUYỆT dmDuyet qua modal → chip đổi 'Đã duyệt'
      const rDuyet = gp.getByTestId('dm-row').filter({ hasText: dmDuyet });
      await expect(rDuyet).toBeVisible({ timeout: 30_000 });
      const btnDuyet = rDuyet.getByTestId('dm-approve');
      await expect(btnDuyet).toBeVisible({ timeout: 20_000 });
      await btnDuyet.click();
      const modal = gp.getByTestId('dm-decide-modal');
      await expect(modal).toBeVisible();
      await modal.getByTestId('dm-decide-submit').click();
      await expect(modal).toBeHidden({ timeout: 20_000 });
      await expect(rDuyet.getByTestId('dm-tt')).toHaveText('Đã duyệt', { timeout: 30_000 });
      await gp.screenshot({ path: 'test-results/dm-03-decided.png', fullPage: true });

      // TỪ CHỐI dmTuChoi — lý do BẮT BUỘC (core từ chối rỗng; UI disable nút)
      const rReject = gp.getByTestId('dm-row').filter({ hasText: dmTuChoi });
      await expect(rReject).toBeVisible({ timeout: 30_000 });
      await rReject.getByTestId('dm-reject').click();
      await expect(modal).toBeVisible();
      await expect(modal.getByTestId('dm-decide-submit')).toBeDisabled(); // chưa lý do
      await modal.getByTestId('dm-decide-lydo').fill('e2e-khong-kha-thi');
      await modal.getByTestId('dm-decide-submit').click();
      await expect(modal).toBeHidden({ timeout: 20_000 });
      await expect(rReject.getByTestId('dm-tt')).toHaveText('Từ chối', { timeout: 30_000 });
    } finally {
      await ctxGiamdoc.close();
    }
  });

  test('(iv) nav link "Mua sắm" hiện với role kho', async ({ page }) => {
    await gotoDm(page);
    const link = page.getByRole('link', { name: 'Mua sắm' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/kho/dm');
    await page.screenshot({ path: 'test-results/dm-04-nav.png' });
  });
});

/* ────────────────────────── soft-delete dữ liệu test ────────────────────────── */
test.afterAll(async () => {
  killDev(); // giết dev :3001 do CHÍNH spec này spawn (nếu có)
  if (createdDmIds.length === 0) return;
  const pool = dbPool();
  try {
    // Cùng cơ chế dmDelete của core: deleted_at = ISO timestamp; header mềm,
    // KHÔNG DELETE cứng (giữ audit). dm_chitiet theo header — không hiện dmList.
    const now = new Date().toISOString();
    const r = await pool.query(
      `UPDATE dm SET deleted_at = $2 WHERE id = ANY($1) AND deleted_at = ''`,
      [createdDmIds, now]
    );
    console.log(`[dm.spec] soft-deleted dm rows: ${r.rowCount}`);
  } catch (e) {
    console.log('[dm.spec] cleanup warn:', (e as Error).message);
  } finally {
    await pool.end();
  }
});
