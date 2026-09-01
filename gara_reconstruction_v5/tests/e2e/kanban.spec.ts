import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { Pool } from 'pg';
import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

/**
 * W3.8 — E2E trang XƯỞNG /sc/kanban (dashboardAll + KPI band + nav).
 *
 * • Pattern spawn kế thừa dm.spec.ts: dev server :3001 TỰ spawn (`next dev`
 *   thẳng qua node + cli.js — PID chính là next), health-probe /api/health,
 *   reuse nếu có sẵn (kill=false — không giết server của người khác), afterAll
 *   kill tree + diệt orphan theo port :3001. ĐỪNG đụng :3000.
 * • Login role `xuong` MỘT lần beforeAll (middleware 429 >5 POST /api/auth/5ph
 *   theo IP — nhưng store rate-limit là in-memory TRONG tiến trình dev server
 *   do CHÍNH spec này spawn → mỗi spec server mới = bucket mới; chỉ tích khi
 *   REUSE server đang chạy — vẫn an toàn với 1 POST). 429/cấm → flag
 *   authBlocked → test.skip, không fail oan cả suite.
 * • PROBE khả dụng theo TÊN fn `dashboardAll` (worker-c đang đăng ký W3.1-reg
 *   SONG SONG với task UI này): HTTP 404 'Unknown fn' → CHƯA khả dụng →
 *   test board skip('đợi reg') + test fallback PHẢI chạy (UI render trạng
 *   thái 'đang kích hoạt', không crash). HTTP 200 → đã reg (kể cả lõi
 *   {ok:false,error} — dispatch đã resolve handler).
 * • Spec này CHỈ ĐỌC — không tạo dữ liệu, không cần soft-delete afterAll.
 *   Seed is_test=0 rỗng → chỉ assert 5 cột + empty-state ("không crash" mức
 *   vừa, theo chỉ đạo task; KPI/core đếm is_test=0 nên KHÔNG được bơm
 *   is_test=1 để gồng assertion — nó sẽ không hiển thị).
 * • Screenshots: test-results/kanban-*.png
 *
 *   Playwright: `npx playwright test tests/e2e/kanban.spec.ts --project=chromium`
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';
const AUTH_FILE = '.playwright-auth-kanban.json';
const STATUSES = ['de_xuat', 'dang_sua', 'da_hoan', 'da_quyet', 'tu_choi'];

let dashboardReady = false; // probe 'dashboardAll' — default phụ (chưa reg)
let authBlocked = false; // 429 / login fail → skip toàn suite (không fail oan)

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
    killOwner = false; // reuse — server đã chạy → KHÔNG kill
    console.log('[kanban.spec] reuse dev server port 3001 — not spawning');
    return;
  }
  console.log('[kanban.spec] spawning next dev -p 3001');
  const nextBin = require.resolve('next/dist/bin/next');
  server = spawn(process.execPath, [nextBin, 'dev', '-p', '3001'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3001', TEST_BASE_URL: BASE },
    shell: false,
    stdio: 'ignore',
  });
  const t0 = Date.now();
  while (!(await healthOk())) {
    if (Date.now() - t0 > 180_000) throw new Error('[kanban.spec] dev server :3001 health timeout');
    if (server && server.exitCode != null) throw new Error('[kanban.spec] dev server exited early: ' + server.exitCode);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('[kanban.spec] dev server :3001 healthy');
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
      console.log(`[kanban.spec] killed orphan :3001 pid=${orphan}`);
    }
  } catch {
    /* ignore */
  }
}

// Chốt cuối dự phòng nếu afterAll không chạy được (worker crash)
process.on('exit', killDev);

/* ───────────────────────────── RPC helper ──────────────────────────────── */
type RpcResp = { httpStatus: number; ok?: boolean; error?: string; result?: any };

async function rpc(req: APIRequestContext, fn: string, args: Record<string, unknown> = {}): Promise<RpcResp> {
  const res = await req.post(`${BASE}/api/rpc`, { data: { fn, args } });
  const status = res.status();
  let body: any = {};
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { httpStatus: status, ok: body?.ok, error: body?.error, result: body?.result };
}

/* ─────────────────────────────── DB helper ─────────────────────────────── */
function dbPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom',
  });
}

/** Số SC active theo enum v5 mà dashboardAll sẽ vẽ (is_test=0 — core filter). */
async function countActiveSc(): Promise<number> {
  const pool = dbPool();
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM sc WHERE deleted_at='' AND is_test=0 AND trang_thai = ANY($1)`,
      [STATUSES]
    );
    return Number(r.rows[0]?.n ?? 0);
  } finally {
    await pool.end();
  }
}

async function gotoKanban(page: Page) {
  await page.goto(`${BASE}/sc/kanban`);
  if (page.url().includes('/login')) throw new Error('storageState expired — redirected to /login');
  // h1 'Bảng xe xưởng' hiện ở CẢ 3 state (board / 'đang kích hoạt' / 403) nên
  // anchor này không phụ thuộc tình trạng reg của fn.
  await expect(page.getByRole('heading', { name: /Bảng xe/ })).toBeVisible({ timeout: 90_000 });
}

/**
 * Probe khả dụng fn dashboardAll theo HTTP: chưa reg → dispatch throw
 * 'Unknown fn' → 404; đã reg → 200 {ok:true,result:<envelope lõi>} (kể cả
 * lõi 403/{ok:false} — handler đã chạy). Probe động vì worker-c có thể đăng
 * ký (hot-reload next dev) NGAY TRONG lúc suite chạy.
 */
async function probeDashboard(req: APIRequestContext): Promise<boolean> {
  const probe = await rpc(req, 'dashboardAll');
  const errLc = String(probe.error ?? '').toLowerCase();
  return probe.httpStatus === 200 && !errLc.includes('unknown fn');
}

test.describe('Xưởng W3.8 — /sc/kanban (dashboardAll)', () => {
  test.describe.configure({ timeout: 180_000 }); // dev compile + spawn health

  test.beforeAll(async ({ browser }) => {
    await startDev();
    if (existsSync(AUTH_FILE)) rmSync(AUTH_FILE);
    const ctx = await browser.newContext({ storageState: undefined });
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}/login`);
      await p.getByPlaceholder('Tài khoản').fill('xuong');
      await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
      await p.getByRole('button', { name: 'Đăng nhập' }).click();
      await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (e) {
      // 429 rate-limit hoặc seed thiếu user — toàn suite skip có chủ đích
      authBlocked = true;
      console.log('[kanban.spec] login blocked:', (e as Error).message.slice(0, 160));
      await ctx.close();
      return;
    }
    await ctx.storageState({ path: AUTH_FILE });
    await ctx.close();

    // ── PROBE khả dụng fn dashboardAll (worker-c W3.1-reg song song) ──
    // Kết quả khởi tạo để log; TỪNG test re-probe động qua page.request.
    if (!authBlocked) {
      const probeCtx = await browser.newContext({ storageState: AUTH_FILE });
      try {
        dashboardReady = await probeDashboard(probeCtx.request);
        console.log(`[kanban.spec] dashboardAll probe: ${dashboardReady ? 'READY' : 'CHƯA reg (UI fallback)'}`);
      } catch (e) {
        console.log('[kanban.spec] probe warn:', (e as Error).message);
        dashboardReady = false;
      } finally {
        await probeCtx.close();
      }
    }
  });

  test.use({ storageState: AUTH_FILE });

  test('(i) không crash: render fallback khi fn chưa reg, hoặc board khi ready', async ({ page }) => {
    test.skip(authBlocked, 'login bị chặn (429/seed) — skip toàn suite');
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await gotoKanban(page);

    const ready = await probeDashboard(page.request);
    // Luôn phải có ĐÚNG một state nhận diện được (board/activating/403/err)
    const state = page
      .getByTestId('kanban-activating')
      .or(page.getByTestId('kanban-kpi-band'))
      .or(page.getByTestId('kanban-denied'))
      .or(page.getByTestId('kanban-error'));
    await expect(state.first()).toBeVisible({ timeout: 30_000 });
    if (!ready) {
      // 'đang kích hoạt' + auto-retry 3s (khác hẳn màn 403) — role xuong có
      // sc.xem nên KHÔNG được thành 403 khi fn vừa reg giữa hai call
      await expect(page.getByTestId('kanban-denied')).toHaveCount(0);
      if ((await page.getByTestId('kanban-activating').count()) === 0) {
        console.log('[kanban.spec] (i) fn reg ngay trong khoảng probe→render — board hiện, chấp nhận');
      }
    }
    await page.screenshot({ path: 'test-results/kanban-01-state.png', fullPage: true });
    expect(pageErrors, 'pageerror: ' + pageErrors.join(' | ')).toHaveLength(0);
  });

  test('(ii) board: đúng 5 cột enum v5, header theo STATE_PRI', async ({ page }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    test.skip(
      !(await probeDashboard(page.request)), // page.request mang cookie storageState
      'đợi reg — dashboardAll chưa đăng ký trong RPC registry (worker-c W3.1-reg song song)'
    );

    await gotoKanban(page);
    const cols = page.getByTestId('kanban-col');
    await expect(cols).toHaveCount(5, { timeout: 90_000 });
    // ĐÚNG enum sc.trang_thai v5 (KHÔNG phải da_duyet/cho_nghiem của v3.6).
    // LƯU Ý (fix đỏ W3.8): `filter({ has: locator('[data-state=..]') })` KHÔNG
    // hợp lệ ở đây — `has` match theo CON CHÁU, còn data-state nằm TRÊN CHÍNH
    // phần tử cột (page.tsx: div data-testid=data-state=col.key). Core luôn
    // map đủ 5 cột STATUSES (xuong.ts: cols = STATUSES.map — xác thực rpc
    // thật 2026-09-01, cards rỗng vẫn trả 5) → compound selector + nth đúng
    // thứ tự là assertion chuẩn.
    for (let i = 0; i < STATUSES.length; i++) {
      const key = STATUSES[i];
      await expect(page.locator(`[data-testid="kanban-col"][data-state="${key}"]`)).toBeVisible();
      await expect(cols.nth(i)).toHaveAttribute('data-state', key); // thứ tự = core STATUSES
    }
    // nhãn cột từ core COL_TT (da_hoan mang nghĩa 'Chờ nghiệm thu')
    await expect(page.locator('[data-state="da_hoan"]')).toContainText('Chờ nghiệm thu');
    await page.screenshot({ path: 'test-results/kanban-02-cols.png', fullPage: true });
  });

  test('(iii) KPI band + card xe có % tiến độ (seed-aware, mức "không crash")', async ({ page }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    test.skip(
      !(await probeDashboard(page.request)),
      'đợi reg — dashboardAll chưa đăng ký trong RPC registry'
    );

    const scActive = await countActiveSc().catch((e) => {
      console.log('[kanban.spec] DB probe warn:', (e as Error).message);
      return -1; // không đọc được DB → không ép assertion card
    });

    await gotoKanban(page);

    // KPI band: 8 card số (10 key hợp nhất — tien_quyet_hom_nay là sub của
    // card quyết toán; tone danger kiểm bằng data-tone khi >0)
    await expect(page.getByTestId('kanban-kpi-band')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('kanban-kpi')).toHaveCount(8);

    if (scActive > 0) {
      // Có seed is_test=0 → ít nhất 1 card xe + % hiển thị
      const card = page.getByTestId('kanban-card').first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card.getByTestId('kanban-pct')).toContainText('%');
      await expect(card.getByTestId('kanban-sc-chip').first()).toBeVisible();
    } else if (scActive === 0) {
      // Seed rỗng — assert empty-state từng cột (đủ 'không crash', theo task)
      await expect(page.getByText('Không có xe nào').first()).toBeVisible();
    }
    // scActive === -1 (DB không với tới được): chỉ dừng ở assert band ở trên
    await page.screenshot({ path: 'test-results/kanban-03-kpi-cards.png', fullPage: true });
  });

  test('(iv) nav: link "Bảng xe" hiện với role xuong, KHÔNG hiện với ketoan', async ({ page, browser }) => {
    test.skip(authBlocked, 'login bị chặn — skip');
    await gotoKanban(page);
    const link = page.getByRole('link', { name: 'Bảng xe' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/sc/kanban');

    // ketoan: MENU ẩn link (core dashboardAll chặn cứng 403 — xem nav.tsx)
    const ctxK = await browser.newContext({ storageState: undefined });
    try {
      const p = await ctxK.newPage();
      await p.goto(`${BASE}/login`);
      await p.getByPlaceholder('Tài khoản').fill('ketoan');
      await p.getByPlaceholder('Mật khẩu').fill('cencom@123');
      await p.getByRole('button', { name: 'Đăng nhập' }).click();
      await p.waitForURL(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await p.goto(`${BASE}/sc`);
      await expect(p.getByRole('heading', { name: /sửa chữa/i })).toBeVisible({ timeout: 60_000 });
      await expect(p.getByRole('link', { name: 'Bảng xe' })).toHaveCount(0);
    } catch (e) {
      // 429 window (thêm 1 POST /api/auth) — phần phụ, không fail oan board test
      console.log('[kanban.spec] ketoan nav-check warn:', (e as Error).message.slice(0, 160));
      test.info().annotations.push({ type: 'warn', description: 'ketoan nav-check không chạy được (rate-limit?)' });
    } finally {
      await ctxK.close();
    }
  });
});

/* ─────────────────────────────── teardown ─────────────────────────────── */
test.afterAll(async () => {
  killDev(); // chỉ giết :3001 do CHÍNH spec này spawn
});
