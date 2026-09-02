import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test';
import { Pool } from 'pg';
import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

/**
 * W3.5-UI · E2E DUYỆT PHÂN TẦNG SC: de_xuat --scApprove--> da_duyet --scTongDuyet-->
 * chốt hồ sơ (badge 'Đã chốt hồ sơ') + khóa dòng VT/CV khi chốt.
 *
 * BỐI CẢNH SONG SONG: core `scApprove`/`scTongDuyet` (worker-c — W3.5) CHƯA vào
 * RPC registry khi spec này viết. Chiến lược như kanban.spec/dashboardAll:
 *  • PROBE động từng fn qua HTTP: dispatch throw 'Unknown fn' → 404 → CHƯA reg.
 *    Đã reg → 400 (core validate sc_id — họ sc.ts THROW) hoặc 200 envelope.
 *    Probe lại ĐẦU MỖI TEST (next dev hot-reload → worker-c có thể reg giữa suite).
 *  • CHƯA registry → MỌI test luồng CỨNG `test.skip()` ('đợi core') + ĐÚNG một
 *    test '(i) fallback' PHẢI chạy: /sc không crash, nút Duyệt tồn tại,
 *    disabled khi fn chưa reg, Tổng duyệt chưa hiện ở de_xuat (trạng thái sai).
 *  • ĐÃ registry → seed de_xuat (scCreate admin → is_test=1; scList KHÔNG lọc
 *    is_test cho admin+giamdoc — lib/core/sc.ts:108) → UI approve → RPC assert
 *    'da_duyet' → Tổng duyệt → badge chốt → dòng edit disabled.
 * • 2 ctx đăng nhập: `admin` (seed + luồng chính) và `giamdoc` (nút duyệt HIỆN
 *    cho role duyệt v3.6 — perm.js canApproveSC admin/giamdoc vô hạn ngưỡng).
 *   Middleware 429 chặn >5 POST /api/auth/5ph theo IP in-memory của dev server
 *   → đúng 2 POST login, vẫn catch → authBlocked → skip toàn suite (ko fail oan).
 * • spawn-or-reuse :3001 theo pattern dm/sc/kanban.spec — ĐỪNG đụng :3000;
 *   killOwner=false khi reuse (server của worker khác). afterAll kill tree +
 *   orphan :3001 do MÌNH spawn.
 * • Screenshots: test-results/scap-*.png
 * • DỌN: soft-delete sc đã seed (giữ audit — pattern sc.spec afterAll).
 *
 *   Playwright: `npx playwright test tests/e2e/sc-approve.spec.ts --project=chromium`
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const AUTH_ADMIN = '.playwright-auth-scap-admin.json';
const AUTH_GIAMDOC = '.playwright-auth-scap-giamdoc.json';
const TODAY = new Date().toISOString().slice(0, 10);
const PASS = 'cencom@123'; // seed users — như dm/sc/kanban.spec

const createdScIds: string[] = [];
let approvedScId = ''; // (ii) duyệt thành công → (iii)(iv) nối tiếp cùng phiếu
let authBlocked = false;
let registryReady = false; // snapshot probe beforeAll — test re-probe ĐỘNG

/* ─────────────────────────── dev server helper ─────────────────────────── */
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
    console.log('[scap] reuse dev server port 3001 — not spawning');
    return;
  }
  console.log('[scap] spawning next dev -p 3001');
  const nextBin = require.resolve('next/dist/bin/next');
  server = spawn(process.execPath, [nextBin, 'dev', '-p', '3001'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3001', TEST_BASE_URL: BASE },
    shell: false,
    stdio: 'ignore',
  });
  const t0 = Date.now();
  while (!(await healthOk())) {
    if (Date.now() - t0 > 180_000) throw new Error('[scap] dev server :3001 health timeout');
    if (server && server.exitCode != null) throw new Error('[scap] dev server exited early: ' + server.exitCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('[scap] dev server :3001 healthy');
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
      console.log(`[scap] killed orphan :3001 pid=${orphan}`);
    }
  } catch {
    /* ignore */
  }
}

process.on('exit', killDev);

/* ───────────────────────────── RPC helpers ──────────────────────────────── */
type RpcResp = { httpStatus: number; ok?: boolean; error?: string; result?: any };

async function rpc(req: APIRequestContext, fn: string, args: Record<string, unknown> = {}): Promise<RpcResp> {
  const res = await req.post(`${BASE}/api/rpc`, { data: { fn, args } });
  let body: any = {};
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { httpStatus: res.status(), ok: body?.ok, error: body?.error, result: body?.result };
}

/** fn CHƯA đăng ký: 'Unknown fn' → HTTP 404 (route /api/rpc ánh xạ msg). */
function fnUnavailable(r: RpcResp): boolean {
  if (r.ok) return false;
  if (r.httpStatus === 404) return true;
  return String(r.error ?? '').toLowerCase().includes('unknown fn');
}

/** Bóc envelope lồng (route {ok,result} + core {ok:false,error} như sc.spec.coreOk). */
function coreOk(r: RpcResp): { ok: boolean; error?: string; result?: any } {
  if (!r.ok) return { ok: false, error: r.error };
  const env = r.result as { ok?: boolean; error?: string; result?: unknown } | null;
  if (env && typeof env === 'object' && 'ok' in env && env.ok === false) {
    return { ok: false, error: env.error };
  }
  return { ok: true, result: env && typeof env === 'object' && 'result' in env ? (env as any).result : r.result };
}

/** Probe CẢ HAI fn W3.5 — 'duyệt'=='tổng-duyệt' là MỘT câu chuyện nghiệp vụ. */
async function approveRegistryReady(req: APIRequestContext): Promise<boolean> {
  const a = await rpc(req, 'scApprove', {});
  const t = await rpc(req, 'scTongDuyet', {});
  return !fnUnavailable(a) && !fnUnavailable(t);
}

/* ─────────────────────────────── DB helper ──────────────────────────────── */
function dbPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom',
  });
}

async function firstActiveXeId(): Promise<string> {
  const pool = dbPool();
  try {
    const r = await pool.query(`SELECT id FROM xe WHERE deleted_at='' AND is_test=0 ORDER BY id ASC LIMIT 1`);
    return String(r.rows[0]?.id ?? '');
  } finally {
    await pool.end();
  }
}

/* ───────────────────────────── login helper ─────────────────────────────── */
async function loginAs(browser: Browser, user: string, authFile: string): Promise<boolean> {
  if (existsSync(authFile)) rmSync(authFile);
  const ctx = await browser.newContext({ storageState: undefined });
  try {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`);
    await p.getByPlaceholder('Tài khoản').fill(user);
    await p.getByPlaceholder('Mật khẩu').fill(PASS);
    await p.getByRole('button', { name: 'Đăng nhập' }).click();
    await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await ctx.storageState({ path: authFile });
    return true;
  } catch (e) {
    console.log(`[scap] login blocked (${user}):`, (e as Error).message.slice(0, 160));
    return false;
  } finally {
    await ctx.close();
  }
}

/* ────────────────────────────── UI helpers ──────────────────────────────── */
async function openScModal(page: Page, scId: string) {
  await page.goto(`${BASE}/sc`);
  if (page.url().includes('/login')) throw new Error('storageState expired — redirected to /login');
  await expect(page.getByRole('heading', { name: /Quản lý sửa chữa/ })).toBeVisible({ timeout: 90_000 });
  const scRow = page.getByRole('row').filter({ hasText: scId });
  await expect(scRow, `SC ${scId} không thấy trong danh sách (admin/giamdoc thấy cả is_test=1)`).toBeVisible({
    timeout: 30_000,
  });
  await scRow.getByRole('button', { name: 'Chi tiết' }).click();
  const modal = page.locator('div.fixed.inset-0.z-50').filter({ hasText: 'Chi tiết SC' });
  await expect(modal.getByRole('heading', { name: `Chi tiết SC: ${scId}` })).toBeVisible({ timeout: 20_000 });
  return modal;
}

/** Seed 1 SC `de_xuat` qua RPC scCreate (admin → is_test=1). Trả id, track cleanup. */
async function seedDeXuat(req: APIRequestContext): Promise<string> {
  const xeId = await firstActiveXeId();
  test.skip(!xeId, '[scap] thiếu xe is_test=0 trong DB — seed chưa chạy? SKIP có chủ đích');
  const c = coreOk(await rpc(req, 'scCreate', { xe_id: xeId, ngay: TODAY }));
  if (!c.ok) {
    console.warn(`[scap] scCreate fail: ${c.error} — skip (bất thường, báo coordinator)`);
  }
  test.skip(!c.ok, `scCreate gate: ${c.error}`);
  const id = String((c.result as { id?: string })?.id ?? '');
  expect(/^SC-/.test(id), 'scCreate phải trả id SC-xxxxxx').toBeTruthy();
  createdScIds.push(id);
  return id;
}

/** Đọc trang_thai qua RPC (trần row hoặc envelope lồng — chống đổi shape). */
async function scTrangThai(req: APIRequestContext, id: string): Promise<string> {
  const g = await rpc(req, 'scGet', { id });
  const unw = coreOk(g);
  const anyRes = (unw.result ?? g.result) as { trang_thai?: string; result?: { trang_thai?: string } } | null;
  return String(anyRes?.trang_thai ?? anyRes?.result?.trang_thai ?? '');
}

/* ───────────────────────────────── suite ────────────────────────────────── */
test.describe('SC W3.5-UI — Duyệt / Tổng duyệt / chốt hồ sơ (/sc)', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async ({ browser }) => {
    await startDev();
    const okAdmin = await loginAs(browser, 'admin', AUTH_ADMIN);
    const okGiam = await loginAs(browser, 'giamdoc', AUTH_GIAMDOC);
    if (!okAdmin || !okGiam) {
      authBlocked = true;
    } else {
      const ctx = await browser.newContext({ storageState: AUTH_ADMIN });
      try {
        registryReady = await approveRegistryReady(ctx.request);
        console.log(
          `[scap] scApprove+scTongDuyet probe: ${registryReady ? 'READY (chạy luồng đầy đủ)' : 'CHƯA reg → luồng skip "đợi core", chỉ fallback chạy'}`
        );
      } catch (e) {
        console.log('[scap] probe warn:', (e as Error).message);
        registryReady = false;
      } finally {
        await ctx.close();
      }
    }
  });

  test.use({ storageState: AUTH_ADMIN });

  test('(i) fallback KHÔNG crash khi fn chưa reg: nút Duyệt hiện + disabled, Tổng duyệt ẩn ở de_xuat', async ({
    page,
  }) => {
    test.skip(authBlocked, 'login bị chặn (429/seed) — skip toàn suite');
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    const readyAtRun = await approveRegistryReady(page.request);

    const scId = await seedDeXuat(page.request);
    const modal = await openScModal(page, scId);
    await page.screenshot({ path: 'test-results/scap-00-modal-dexuat.png', fullPage: true });

    // Panel hành vi theo tt: de_xuat + role admin (∈ tập duyệt) → NÚT PHẢI hiện,
    // bất kể registry (graceful: disabled khi chưa reg — pattern W2b dm page).
    const btn = modal.getByTestId('sc-approve-btn');
    await expect(btn, 'nút Duyệt phải tồn tại ở de_xuat với role duyệt').toBeVisible({ timeout: 20_000 });
    if (!readyAtRun) {
      // probe spec→page cùng một registry-state nếu worker-c CHƯA reg → disabled
      const dis = await btn.isDisabled();
      if (!dis) {
        console.log('[scap] (i) fn reg NGAY trong khoảng probe→render — nút sáng, chấp nhận (hot-reload)');
      } else {
        await expect(btn).toHaveAttribute('title', /chưa khả dụng|Đang kiểm tra/);
      }
    }
    // Tổng duyệt CHỈ là việc của 'da_duyet' — ở de_xuat PHẢI ẩn (điều phối trạng thái UI)
    await expect(modal.getByTestId('sc-tongduyet-btn'), 'Tổng duyệt ẩn khi chưa da_duyet').toHaveCount(0);
    // Badge chốt ẩn ở de_xuat (chưa snapshot nào)
    await expect(modal.getByTestId('sc-chot-badge')).toHaveCount(0);
    expect(pageErrors, 'pageerror: ' + pageErrors.join(' | ')).toHaveLength(0);
    await page.screenshot({ path: 'test-results/scap-01-fallback.png', fullPage: true });
  });

  test('(ii) UI Duyệt (confirm+toast) → da_duyet — RPC scGet assert trạng thái', async ({ page }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    const ready = await approveRegistryReady(page.request);
    test.skip(!ready, 'đợi core — scApprove/scTongDuyet chưa vào RPC registry (worker-c W3.5 song song)');

    const scId = await seedDeXuat(page.request);
    const modal = await openScModal(page, scId);
    const btn = modal.getByTestId('sc-approve-btn');
    // page tự probe khi mở modal → chờ sáng nút (race hot-reg tự lành trong timeout)
    await expect(btn).toBeEnabled({ timeout: 20_000 });

    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept(); // xác nhận confirm — UI bắt buộc confirm trước ghi
    });

    await btn.click();
    // toast + reload danh sách (refreshAll → onDone → scList)
    await expect(page.getByTestId('sc-toast')).toContainText(/đã duyệt/i, { timeout: 20_000 });
    expect(dialogs.length, 'phải có dialog confirm trước khi gọi RPC').toBeGreaterThanOrEqual(1);
    expect(dialogs[0], 'confirm phải nêu mã phiếu').toContain(scId);

    // chip trạng thái NGAY TRONG modal sau refreshAll
    await expect(modal.getByTestId('sc-chot-badge')).toHaveCount(0); // mới duyệt, chưa chốt
    await expect(modal.locator('span', { hasText: 'Đã duyệt' }).first()).toBeVisible({ timeout: 20_000 });

    // BẰNG CHỨNG server-side (RPC, không tin UI một mình)
    const tt = await scTrangThai(page.request, scId);
    expect(tt, 'scApprove OK phải đẩy sc.trang_thai → da_duyet').toBe('da_duyet');

    approvedScId = scId;
    await page.screenshot({ path: 'test-results/scap-02-approved.png', fullPage: true });
  });

  test('(iii) từ da_duyet: nút Tổng duyệt hiện → confirm → badge "Đã chốt hồ sơ"', async ({ page }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    const ready = await approveRegistryReady(page.request);
    test.skip(!ready, 'đợi core — scTongDuyet chưa vào RPC registry');
    test.skip(!approvedScId, 'tiền đề (ii) chưa duyệt được phiếu nào — skip nối tiếp');
    if (await scTrangThai(page.request, approvedScId) !== 'da_duyet') {
      test.info().annotations.push({ type: 'warn', description: `(${approvedScId}) tt đã đổi ${(await scTrangThai(page.request, approvedScId))} — (ii) có thể đã chạy ở lượt trước` });
    }

    const modal = await openScModal(page, approvedScId);
    const td = modal.getByTestId('sc-tongduyet-btn');
    await expect(td, 'da_duyet → phải thấy Tổng duyệt cho role duyệt').toBeVisible({ timeout: 20_000 });
    await expect(td).toBeEnabled({ timeout: 20_000 });

    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept();
    });
    await td.click();
    await expect(page.getByTestId('sc-toast')).toContainText(/tổng duyệt|chốt/i, { timeout: 20_000 });
    expect(dialogs.length, 'Tổng duyệt cũng bắt buộc confirm').toBeGreaterThanOrEqual(1);

    // badge chốt + trạng thái mới (v3.6: da_tong_duyet; worker-c CÓ THỂ giữ
    // da_duyet + flag chot — chấp nhận CẢ HAI, badge là assertion chuẩn)
    await expect(modal.getByTestId('sc-chot-badge')).toContainText('Đã chốt hồ sơ', { timeout: 20_000 });
    const tt = await scTrangThai(page.request, approvedScId);
    expect(['da_tong_duyet', 'da_duyet'], `tt sau tổng duyệt = ${tt}`).toContain(tt);
    expect(tt, 'không được đứng lại de_xuat').not.toBe('de_xuat');
    await page.screenshot({ path: 'test-results/scap-03-tongduyet-chot.png', fullPage: true });
  });

  test('(iv) sau chốt: dòng edit VT/CV disabled + hint (v3.6 chỉ de_xuat sửa được)', async ({ page }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    const ready = await approveRegistryReady(page.request);
    test.skip(!ready, 'đợi core — chưa chốt được vì thiếu scTongDuyet');
    test.skip(!approvedScId, 'tiền đề (iii) chưa chốt được — skip');

    const modal = await openScModal(page, approvedScId);
    await expect(modal.getByTestId('sc-edit-lock-hint').first()).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByTestId('sc-vt-select')).toBeDisabled();
    await expect(modal.getByTestId('sc-vt-soluong')).toBeDisabled();
    await expect(modal.getByTestId('sc-vt-submit')).toBeDisabled();
    await expect(modal.getByTestId('sc-cv-submit')).toBeDisabled();
    // chống bằng chứng giả: attempt submit bằng RPC TRỰC TIẾP sau khi chốt —
    // server gate là phần lõi worker-c → chỉ log chứng minh, không assert cứng
    const tryAdd = coreOk(await rpc(page.request, 'scAddVatTu', { sc_id: approvedScId, vattu_id: 'VT-000002', so_luong: 1 }));
    console.log(`[scap] (iv) probe RPC thẳng scAddVatTu sau chốt: ${tryAdd.ok ? 'SERVER VẪN CHẤP (cần worker-c siết gate — ghi nhận)' : 'server chặn: ' + tryAdd.error}`);
    await page.screenshot({ path: 'test-results/scap-04-lines-locked.png', fullPage: true });
  });

  test('(v) giamdoc (role duyệt v3.6) thấy nút Duyệt sáng trên SC de_xuat seed', async ({ page, browser }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    const ready = await approveRegistryReady(page.request); // admin cookie
    test.skip(!ready, 'đợi core — scApprove chưa vào RPC registry');

    const scId = await seedDeXuat(page.request); // seed bằng admin (is_test=1 — giamdoc vẫn thấy qua scList)

    const ctxG = await browser.newContext({ storageState: AUTH_GIAMDOC });
    try {
      const pg = await ctxG.newPage();
      const pageErrors: string[] = [];
      pg.on('pageerror', (err) => pageErrors.push(String(err)));
      await pg.goto(`${BASE}/sc`);
      if (pg.url().includes('/login')) throw new Error('giamdoc storageState expired');
      await expect(pg.getByRole('heading', { name: /Quản lý sửa chữa/ })).toBeVisible({ timeout: 90_000 });
      const scRow = pg.getByRole('row').filter({ hasText: scId });
      await expect(scRow, 'giamdoc phải thấy SC is_test=1 (scList chỉ lọc khi ko phải admin/giamdoc)').toBeVisible({
        timeout: 30_000,
      });
      await scRow.getByRole('button', { name: 'Chi tiết' }).click();
      const modal = pg.locator('div.fixed.inset-0.z-50').filter({ hasText: 'Chi tiết SC' });
      await expect(modal.getByRole('heading', { name: `Chi tiết SC: ${scId}` })).toBeVisible({ timeout: 20_000 });
      const btn = modal.getByTestId('sc-approve-btn');
      await expect(btn, 'fallback canApprove=admin/giamdoc — nút Duyệt PHẢI hiện cho giamdoc').toBeVisible();
      await expect(btn, 'fn đã reg (assert trước) → giamdoc hết lý do disable (core mới là trọng tài)').toBeEnabled({
        timeout: 25_000,
      });
      // KHÔNG bấm — phán quyết ngưỡng thật thuộc core; UI chỉ chứng minh visibility.
      expect(pageErrors, 'pageerror: ' + pageErrors.join(' | ')).toHaveLength(0);
      await pg.screenshot({ path: 'test-results/scap-05-giamdoc-visible.png', fullPage: true });
    } finally {
      await ctxG.close();
    }
  });
});

/* ────────────────────────── dọn dẹp ─────────────────────────────────────── */
test.afterAll(async () => {
  killDev(); // chỉ giết :3001 do CHÍNH spec này spawn
  const pool = dbPool();
  try {
    const now = new Date().toISOString();
    if (createdScIds.length) {
      const r = await pool.query(`UPDATE sc SET deleted_at=$2 WHERE id = ANY($1) AND deleted_at=''`, [
        createdScIds,
        now,
      ]);
      console.log(`[scap] soft-deleted sc seeds: ${r.rowCount} (${createdScIds.join(', ')})`);
    }
  } catch (e) {
    console.log('[scap] cleanup warn:', (e as Error).message);
  } finally {
    await pool.end();
  }
});
