import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'fs';

/**
 * W4.5a/W4.6 — E2E tiêu thụ `?q=` trên 3 trang (search-params).
 *
 * Gate của task:
 *  1) 3 URL `/xe?q=BKS…`, `/kho?q=BKS…`, `/kho/dm?q=<DM-id>` KHÔNG crash và
 *     hiện chip "N kết quả".
 *  2) fn `globalSearch` ĐÃ registry → RPC HTTP 200, envelope 2 tầng ok:true
 *     (khác nhánh "fn chưa sẵn sàng" — UI có note riêng, assert KHÔNG xuất hiện).
 *  3) Số lần gọi RPC globalSearch khớp thao tác (mount 1 lần — validate DOM
 *     + đếm request, pattern task "assert DOM + RPC call số").
 *  4) `test-results/sp-*.png`.
 *
 * Server bootstrap: spawn-or-reuse :3001 ĐÚNG khuôn kho.spec.ts (không đụng
 * :3000). Login MỘT lần/role ở beforeAll (middleware 5 POST auth / 5 phút —
 * model login-lặp 429 treo test; đã gặp ở W1.7).
 *
 * Data: spec TỰ seed qua RPC đúng role (is_test=0 để lọt cả xeList/vattuList/
 * dmList LẪN globalSearch nhánh non-admin — không giả định nội dung DB):
 *   xuong → xeCreate bien_so `BKS######` (unique theo timestamp).
 *   kho   → vattuCreate ten chứa bien_so đó → dmCreate 1 dòng.
 * afterAll soft-delete (deleted_at=id — cùng cơ chế app, KHÔNG DELETE cứng).
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const TS = Date.now();
const XE_BIEN = `BKS${String(TS).slice(-6)}`; // khớp yêu cầu gate "?q=BKS…"
const VT_TEN = `${XE_BIEN} l-oc-e2e`; // ten chứa term → /kho?q=XE_BIEN dính
const TODAY = new Date().toISOString().slice(0, 10);
const AUTH_X = '.playwright-auth-sp-xuong.json';
const AUTH_K = '.playwright-auth-sp-kho.json';

const ids = { xeId: '', vtId: '', dmId: '' };

/* ─────────────── RPC qua ctx.request (contract POST /api/rpc {fn,args}) ─────────────── */
async function rpcCall(
  req: import('@playwright/test').APIRequestContext,
  fn: string,
  args: Record<string, unknown>
): Promise<{ ok?: boolean; error?: string; result?: any; httpStatus: number }> {
  const res = await req.post(`${BASE}/api/rpc`, { data: { fn, args } });
  let body: any = {};
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { httpStatus: res.status(), ok: body?.ok, error: body?.error, result: body?.result };
}

/* ─────────────────────────── dev server helper (khuôn kho.spec) ─────────────────────────── */
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
    killOwner = false; // reuse — không giết server của người khác
    console.log('[search-params] reuse dev server port 3001 — not spawning');
    return;
  }
  console.log('[search-params] spawning next dev -p 3001');
  const nextBin = require.resolve('next/dist/bin/next');
  server = spawn(process.execPath, [nextBin, 'dev', '-p', '3001'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3001', TEST_BASE_URL: BASE },
    shell: false,
    stdio: 'ignore',
  });
  const t0 = Date.now();
  while (!(await healthOk())) {
    if (Date.now() - t0 > 180_000) throw new Error('[search-params] dev server :3001 health timeout');
    if (server && server.exitCode != null) throw new Error('[search-params] dev server exited early: ' + server.exitCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('[search-params] dev server :3001 healthy');
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
      console.log(`[search-params] killed orphan :3001 pid=${orphan}`);
    }
  } catch {
    /* ignore */
  }
}

process.on('exit', killDev); // chốt dự phòng nếu afterAll không chạy

/* ─────────────────────────── login helper ─────────────────────────── */
/** Login 1 lần/role (middleware 5 POST auth / 5 phút) → trả ctx ĐÃ có phiên
 *  để vừa RPC seed qua ctx.request, vừa lưu storageState — khỏi login lần 2. */
async function loginCtx(browser: import('@playwright/test').Browser, user: string) {
  const ctx = await browser.newContext({ storageState: undefined });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.getByPlaceholder('Tài khoản').fill(user);
  await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
  await p.getByRole('button', { name: 'Đăng nhập' }).click();
  await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await p.close();
  return ctx;
}

/** Đếm request globalSearch (gate: "RPC call số") — attach TRƯỚC goto. */
function watchGlobalSearch(page: Page): string[] {
  const qs: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST' || !r.url().endsWith('/api/rpc')) return;
    try {
      const b = JSON.parse(String(r.postData()));
      if (b && b.fn === 'globalSearch') qs.push(String(b.args && b.args.q));
    } catch {
      /* body rác — bỏ */
    }
  });
  return qs;
}

/* ══════════════════════════════════ SUITE ══════════════════════════════════ */

test.beforeAll(async ({ browser }) => {
  test.describe.configure({ timeout: 240000 });
  await startDev();
  if (existsSync(AUTH_X)) rmSync(AUTH_X);
  if (existsSync(AUTH_K)) rmSync(AUTH_K);

  // xuong: xeCreate bien_so unique (is_test=0 → lọt cả xeList + globalSearch
  // nhánh thường, không giả định dữ liệu seed có sẵn).
  const cxu = await loginCtx(browser, 'xuong');
  const xeRes = await rpcCall(cxu.request, 'xeCreate', { bien_so: XE_BIEN, chu_xe: 'E2E W4.5a' });
  if (!xeRes.ok) throw new Error(`seed xeCreate fail: ${xeRes.httpStatus} ${xeRes.error}`);
  ids.xeId = String(xeRes.result?.id ?? '');
  if (!/^XE-/.test(ids.xeId)) throw new Error(`seed xe id lạ: ${JSON.stringify(xeRes.result)}`);
  await cxu.storageState({ path: AUTH_X });
  await cxu.close();

  // kho: vattu + DM cùng term (dmCreate cần vattu_id thật — đi đúng RPC
  // business path, không INSERT tay).
  const ckh = await loginCtx(browser, 'kho');
  const vtRes = await rpcCall(ckh.request, 'vattuCreate', { ten: VT_TEN, don_vi: 'cái', gia: 1000, ton_min: 5 });
  if (!vtRes.ok) throw new Error(`seed vattuCreate fail: ${vtRes.httpStatus} ${vtRes.error}`);
  ids.vtId = String(vtRes.result?.id ?? '');
  if (!/^VT-/.test(ids.vtId)) throw new Error(`seed vattu id lạ: ${JSON.stringify(vtRes.result)}`);
  const dmRes = await rpcCall(ckh.request, 'dmCreate', {
    items: [{ vattu_id: ids.vtId, so_luong: 2, don_gia: 1000 }],
    ngay: TODAY,
  });
  if (!dmRes.ok) throw new Error(`seed dmCreate fail: ${dmRes.httpStatus} ${dmRes.error}`);
  ids.dmId = String(dmRes.result?.id ?? '');
  if (!/^DM-/.test(ids.dmId)) throw new Error(`seed dm id lạ: ${JSON.stringify(dmRes.result)}`);
  await ckh.storageState({ path: AUTH_K });
  await ckh.close();
  console.log(`[search-params] seeded xe=${ids.xeId} vattu=${ids.vtId} dm=${ids.dmId} term=${XE_BIEN}`);
});

test.afterAll(async () => {
  killDev();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom',
  });
  try {
    // soft-delete đúng cơ chế app (deleted_at=id) — giữ audit, không DELETE cứng
    if (ids.dmId) {
      await pool.query('UPDATE dm_chitiet SET deleted_at = id WHERE dm_id = $1 AND deleted_at = $2', [ids.dmId, '']);
      await pool.query('UPDATE dm SET deleted_at = id WHERE id = $1 AND deleted_at = $2', [ids.dmId, '']);
    }
    if (ids.vtId) await pool.query('UPDATE vattu SET deleted_at = id WHERE id = $1 AND deleted_at = $2', [ids.vtId, '']);
    if (ids.xeId) await pool.query('UPDATE xe SET deleted_at = id WHERE id = $1 AND deleted_at = $2', [ids.xeId, '']);
    console.log('[search-params] cleanup soft-deleted seed rows');
  } finally {
    await pool.end();
  }
});

/* ───────────────────────────── /xe ───────────────────────────── */

test.describe('/xe?q= — globalSearch.xe[] + ô từ khóa + clear', () => {
  test.describe.configure({ timeout: 180000 });
  test.use({ storageState: AUTH_X });

  test('mount ?q=BKS… → 1 RPC globalSearch, chip "1 kết quả", highlight <mark>, không crash', async ({ page }) => {
    const qs = watchGlobalSearch(page);
    await page.goto(`${BASE}/xe?q=${encodeURIComponent(XE_BIEN)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Bảng xe' })).toBeVisible({ timeout: 90000 });

    // input seed từ URL (mount searchParams.q)
    await expect(page.getByTestId('xe-q')).toHaveValue(XE_BIEN, { timeout: 30000 });

    const info = page.getByTestId('xe-search-info');
    await expect(info).toBeVisible({ timeout: 30000 });
    await expect(info).toContainText(/1 kết quả/); // term là biển số unique

    // highlight = React <mark> (KHÔNG innerHTML) + đúng biển số
    const row = page.locator('tr').filter({ hasText: XE_BIEN }).first();
    await expect(row).toBeVisible();
    expect(await row.locator('mark').count()).toBeGreaterThanOrEqual(1);

    // globalSearch đã registry: KHÔNG rơi vào nhánh "chưa sẵn sàng"
    await expect(page.locator('text=globalSearch chưa sẵn sàng')).toHaveCount(0);

    // RPC call số: mount → đúng 1 lần (không spam mỗi render)
    expect(qs.length).toBeGreaterThanOrEqual(1);
    expect(qs.length).toBeLessThanOrEqual(2); // 2 = dung sai StrictMode dev
    for (const q of qs) expect(q).toBe(XE_BIEN);

    await page.screenshot({ path: 'test-results/sp-01-xe-q.png', fullPage: true });
  });

  test('nút clear xóa q khỏi URL + ẩn chip + list đầy đủ trở lại', async ({ page }) => {
    await page.goto(`${BASE}/xe?q=${encodeURIComponent(XE_BIEN)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('xe-search-info')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('xe-search-clear').click();
    await expect(page.getByTestId('xe-q')).toHaveValue('');
    await expect(page.getByTestId('xe-search-info')).toBeHidden();
    await expect(page).toHaveURL((u) => !u.search.includes('q='), { timeout: 15000 });
    // list thường còn nguyên (không crash sau clear)
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/sp-02-xe-clear.png', fullPage: true });
  });

  test('q không khớp → "0 kết quả" (chip vẫn hiện N, không crash)', async ({ page }) => {
    const qs = watchGlobalSearch(page);
    await page.goto(`${BASE}/xe?q=zzkhongco${String(TS).slice(-4)}`, { waitUntil: 'domcontentloaded' });
    const info = page.getByTestId('xe-search-info');
    await expect(info).toBeVisible({ timeout: 60000 });
    await expect(info).toContainText(/0 kết quả/);
    expect(qs.length).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: 'test-results/sp-03-xe-zero.png', fullPage: true });
  });
});

/* ───────────────────────────── /kho (tab Vật tư) ───────────────────────────── */

test.describe('/kho?q= — tab Vật tư từ globalSearch.vattu[] + highlight + chip', () => {
  test.describe.configure({ timeout: 180000 });
  test.use({ storageState: AUTH_K });

  test('mount ?q= tự bật tab Vật tư, chip "N kết quả", highlight tên, giữ realtime (SSE mở)', async ({ page }) => {
    const qs = watchGlobalSearch(page);
    let sse = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/realtime')) sse = true;
    });
    await page.goto(`${BASE}/kho?q=${encodeURIComponent(XE_BIEN)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Quản lý kho' })).toBeVisible({ timeout: 90000 });

    // tab Vật tư active → cột 'Tối thiểu' của VattuListView hiển thị
    await expect(page.locator('th', { hasText: 'Tối thiểu' }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('kho-q')).toHaveValue(XE_BIEN);

    const chip = page.getByTestId('kho-result-chip');
    await expect(chip).toBeVisible({ timeout: 30000 });
    await expect(chip).toContainText(/1 kết quả/); // ten vattu unique chứa term

    const row = page.getByTestId('vattu-row').filter({ hasText: XE_BIEN }).first();
    await expect(row).toBeVisible();
    expect(await row.locator('mark').count()).toBeGreaterThanOrEqual(1); // highlight React-text
    expect(await row.getByText('BKS').count()).toBeGreaterThan(0); // tên render ĐỦ chuỗi cũ (không mất ký tự)

    await expect(page.locator('text=lọc client')).toHaveCount(0); // registry ok
    expect(qs.length).toBeGreaterThanOrEqual(1);
    expect(qs.length).toBeLessThanOrEqual(2);
    for (const q of qs) expect(q).toBe(XE_BIEN);

    await expect.poll(() => sse, { timeout: 15000 }).toBe(true); // realtime SSE cũ vẫn mở

    await page.screenshot({ path: 'test-results/sp-04-kho-vattu-q.png', fullPage: true });
  });

  test('clear → ẩn chip, URL sạch q, bảng vật tư thường trở lại', async ({ page }) => {
    await page.goto(`${BASE}/kho?q=${encodeURIComponent(XE_BIEN)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('kho-result-chip')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('kho-search-clear').click();
    await expect(page.getByTestId('kho-q')).toHaveValue('');
    await expect(page.getByTestId('kho-result-chip')).toBeHidden();
    await expect(page).toHaveURL((u) => !u.search.includes('q='), { timeout: 15000 });
    await page.screenshot({ path: 'test-results/sp-05-kho-clear.png', fullPage: true });
  });
});

/* ───────────────────────────── /kho/dm ───────────────────────────── */

test.describe('/kho/dm?q= — dm[] từ globalSearch (id) ∩ dmList', () => {
  test.describe.configure({ timeout: 180000 });
  test.use({ storageState: AUTH_K });

  test('mount ?q=<DM id> → row khớp + chip "N kết quả" + highlight mã', async ({ page }) => {
    const qs = watchGlobalSearch(page);
    await page.goto(`${BASE}/kho/dm?q=${encodeURIComponent(ids.dmId)}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Mua sắm — Đề nghị mua' })).toBeVisible({ timeout: 90000 });

    await expect(page.getByTestId('dm-q')).toHaveValue(ids.dmId);
    const info = page.getByTestId('dm-search-info');
    await expect(info).toBeVisible({ timeout: 30000 });
    await expect(info).toContainText(/1 kết quả/); // DM seed unique — không dính bản khác

    const row = page.getByTestId('dm-row').filter({ hasText: ids.dmId }).first();
    await expect(row).toBeVisible();
    expect(await row.locator('mark').count()).toBeGreaterThanOrEqual(1);

    await expect(page.getByTestId('dm-search-note')).toHaveCount(0); // không degrade lọc client
    expect(qs.length).toBeGreaterThanOrEqual(1);
    expect(qs.length).toBeLessThanOrEqual(2);
    for (const q of qs) expect(q).toBe(ids.dmId);

    await page.screenshot({ path: 'test-results/sp-06-kho-dm-q.png', fullPage: true });
  });

  test('fn globalSearch ĐÃ registry — envelope 2 tầng ok qua HTTP (gate W4-reg)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/rpc`, {
      data: { fn: 'globalSearch', args: { q: XE_BIEN, limit: 5 } },
    });
    expect(res.status()).toBe(200); // fn tồn tại + quyền sc.xem → không 404/403
    const body = await res.json();
    expect(body.ok).toBe(true); // lớp route
    expect(body.result?.ok).toBe(true); // lớp core envelope (search.ts)
    expect(Array.isArray(body.result?.result?.xe)).toBe(true);
    expect(Array.isArray(body.result?.result?.vattu)).toBe(true);
    expect(Array.isArray(body.result?.result?.dm)).toBe(true);
    expect(Array.isArray(body.result?.result?.sc)).toBe(true);
    // đúng bản ghi đã seed trong phiên (không giả định nội dung DB)
    const xe = (body.result.result.xe as Array<{ bien_so: string }>).find((x) => x.bien_so === XE_BIEN);
    expect(xe?.bien_so).toBe(XE_BIEN);
  });
});
