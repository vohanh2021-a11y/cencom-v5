#!/usr/bin/env node
/**
 * Onpremise/scripts/smoke_onpremise.mjs — GĐ9: kiểm tra END-TO-END stack
 * on-premise chạy thật (KHÔNG phải supertest in-process như conformance):
 *   1 login → 2 dashboardAll → 3 scList phân trang → 4 export xlsx → 5-6 MCP
 *   initialize + tools/call qua nginx HTTPS.
 *
 * Chạy trên Ubuntu server (default = nginx 443 tự signed):
 *   cd Onpremise && node scripts/smoke_onpremise.mjs
 * Kiểm tra khi nginx bind cổng lệch (override Windows dev):
 *   SMOKE_BASE=https://127.0.0.1:18443 \
 *     MCP_USER=mcp-gara MCP_PASS=... MCP_API_KEY=... node scripts/smoke_onpremise.mjs
 *
 * Tài khoản test: tạo bằng db/migrate/seed mặc định (role admin, pass
 * cencom@123) hoặc create-mcp-user.ts (khuyến nghị — must_change=0).
 * Exit 0 = toàn chuỗi sống; 1 = có lỗi (mỗi bước in lý do).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // cert self-signed LAN

const BASE = process.env.SMOKE_BASE || 'https://127.0.0.1';
const USER = process.env.MCP_USER || 'mcp-gara';
const PASS = process.env.MCP_PASS || process.env.CENCOM_TEST_PASS || 'cencom@123';
const API = process.env.MCP_API_KEY || '';

let RC = 0;
const fail = (m) => { console.error('❌ ' + m); RC = 1; };

async function main() {
  // 1) login session (API cookie sid)
  const r1 = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', user: USER, pass: PASS }),
  });
  const j1 = await r1.json().catch(() => ({}));
  if (r1.status !== 200) fail(`login ${r1.status} — sai tài khoản? tạo bằng scripts/create-mcp-user`);
  const cookie = (r1.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  console.log(`1. LOGIN ${r1.status} ${JSON.stringify(j1).slice(0, 80)}`);

  // 2) dashboardAll KPI
  const r2 = await fetch(`${BASE}/api/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ fn: 'dashboardAll', args: {} }),
  });
  const j2 = await r2.json().catch(() => ({}));
  const kpi = j2.result?.result?.kpi ?? j2.result?.kpi;
  if (!j2.ok || r2.status !== 200) fail('dashboardAll RPC lỗi');
  console.log(`2. dashboardAll HTTP ${r2.status} ok=${j2.ok} kpi=${kpi ? 'xe:' + kpi.xe : 'n/a'}`);

  // 3) scList phân trang server-side (GĐ6): limit=3 tối đa 3 dòng
  const r3 = await fetch(`${BASE}/api/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ fn: 'scList', args: { limit: 3 } }),
  });
  const j3 = await r3.json().catch(() => ({}));
  const rows = j3.result?.result ?? j3.result ?? [];
  if (!Array.isArray(rows) || rows.length > 3) fail(`scList limit=3 trả ${rows.length} dòng`);
  console.log(`3. scList limit=3 → ${Array.isArray(rows) ? rows.length : '?'} dòng (ok=${j3.ok})`);

  // 4) export Excel thật
  const r4 = await fetch(`${BASE}/api/export/tonghop`, { headers: { cookie } });
  const len = (await r4.arrayBuffer()).byteLength;
  if (!(r4.headers.get('content-type') || '').includes('spreadsheetml')) fail('export sai content-type');
  console.log(`4. export tonghop ${r4.status} xlsx ${(len / 1024).toFixed(1)}KB`);

  // 5) MCP initialize — qua nginx /mcp, Bearer API key
  if (!API) {
    console.warn('⚠ 5-6. BỎ QUA MCP (MCP_API_KEY chưa set)');
  } else {
    const initBody = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } },
    };
    const H = (sid) => ({
      'Content-Type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${API}`,
      ...(sid ? { 'mcp-session-id': sid } : {}),
    });
    const r5 = await fetch(`${BASE}/mcp`, { method: 'POST', headers: H(), body: JSON.stringify(initBody) });
    const sid = r5.headers.get('mcp-session-id') || '';
    await r5.text();
    if (!sid && r5.status !== 200) fail(`MCP initialize ${r5.status}`);
    console.log(`5. MCP initialize ${r5.status} session=${sid.slice(0, 8) || 'KHONG CO'}`);

    // 6) tools/call một fn READ để chứng minh DB sống
    await fetch(`${BASE}/mcp`, {
      method: 'POST', headers: H(sid),
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    const r6 = await fetch(`${BASE}/mcp`, {
      method: 'POST', headers: H(sid),
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'dashboardAll', arguments: {} } }),
    });
    const t6 = await r6.text();
    // MCP trả content[].text = JSON ENCODE LẠI (escape \"ok\": true) → so loose
    if (!/\\?"ok\\?"?:\s*true/.test(t6)) fail('MCP tools/call không trả ok:true');
    console.log(`6. MCP tools/call ${r6.status} ${t6.slice(0, 60)}...`);
  }

  console.log(RC === 0 ? '\n=== SMOKE ON-PREMISE: PASS ===' : '\n=== SMOKE: CÓ LỖI (xem ❌ trên) ===');
}

main().catch((e) => { fail('smoke exception: ' + e.message); })
  .finally(() => setTimeout(() => process.exit(RC), 250));
