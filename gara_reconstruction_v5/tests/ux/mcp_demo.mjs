#!/usr/bin/env node
/**
 * tests/ux/mcp_demo.mjs — MCP UAT Demo
 *
 * Mo phong AI host (Claude / Cursor / opencode) ket noi MCP server qua stdio
 * va hoi 5 cau bang tieng Viet. Moi cau goi 1 MCP tool phu hop.
 *
 * Chay: node tests/ux/mcp_demo.mjs  (tu thu muc gara_reconstruction_v5)
 * Output: tests/ux/mcp_demo_output.md
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

// ─── paths ───────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// ─── load .env.local vao process.env (database-url cho parent) ───
function loadEnvFile(filePath) {
  try {
    const buf = readFileSync(filePath);
    let content;
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      content = buf.toString('utf16le').slice(1);
    } else {
      content = buf.toString('utf8');
    }
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  } catch { /* file not found — fall through */ }
}
loadEnvFile(join(PROJECT_ROOT, 'mcp-server', '.env.mcp'));
loadEnvFile(join(PROJECT_ROOT, '.env.local'));

// ─── lay sc_id tu DB (parent process) ────────────────────────────
let scId = 'SC-000001';
const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom';
const pool = new pg.Pool({ connectionString: dbUrl, max: 1 });
try {
  const r = await pool.query("SELECT id FROM sc WHERE deleted_at = '' LIMIT 1");
  if (r.rows[0]?.id) scId = r.rows[0].id;
  console.log(`[db] sc_id = ${scId}`);
} catch (e) {
  console.warn(`[db] query failed, using fallback sc_id=${scId}: ${e.message}`);
} finally {
  await pool.end();
}

// ─── thiet lap MCP client ────────────────────────────────────────
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'mcp-server/index.ts'],
  cwd: PROJECT_ROOT,
  stderr: 'pipe',                       // bat stderr de debug
  env: {
    ...process.env,                      // ke DATABASE_URL
    MCP_USER: 'admin',
    MCP_PASS: 'cencom@123',
    MCP_ROLE: 'admin',
    MCP_WRITE_TOOLS: 'scCreate,scAddCongViec,scQuyetToan',
  },
});

const client = new Client({ name: 'mcp-uat-demo', version: '1.0.0' });

// ─── cau hoi demo ────────────────────────────────────────────────
const QUESTIONS = [
  {
    q: 'Xe biển 51C-12345 hiện có trong hệ thống không?',
    fn: 'xeList',
    args: {},
    /** Rut gon ket qua tra ve moi tieng Viet */
    summarize(text) {
      try {
        const d = JSON.parse(text);
        // handler co the tra array truc tiep hoac {ok, result:[], ...}
        const rows = Array.isArray(d) ? d : (d.result ?? []);
        const hit = rows.filter((x) => (x.bien_so ?? '').includes('51C-12345'));
        if (hit.length) return `Tim thay ${hit.length} xe: ${hit.map((x) => `${x.id} (${x.bien_so})`).join(', ')}`;
        return `Khong tim thay 51C-12345. Tong ${rows.length} xe trong he thong. Mau: ${rows.slice(0, 3).map((x) => `${x.id} / ${x.bien_so}`).join(', ')}`;
      } catch { return text; }
    },
  },
  {
    q: `${scId} — thieu buoc nao trong 8 buoc QC206?`,
    fn: 'hoSoCheck',
    get args() { return { sc_id: scId }; },
    summarize(text) {
      try {
        const d = JSON.parse(text);
        // hoSoCheck tra {ok, steps:[], miss:[]}
        if (Array.isArray(d)) return `Loi: du lieu khong hop le`;
        if (!d.ok && d.miss) return `SC ${scId}: ${d.miss.join('; ')}`;
        const steps = d.steps ?? [];
        const miss = steps.filter((s) => !s.ok);
        if (!miss.length) return `SC ${scId}: Day du 8 buoc ✅`;
        return `SC ${scId}: Thiếu ${miss.length}/${steps.length} buoc: ${miss.map((s) => `#${s.step} ${s.label}`).join('; ')}`;
      } catch { return text; }
    },
  },
  {
    q: 'Liệt kê 10 lệnh sửa chữa đang mở',
    fn: 'scList',
    args: {},
    summarize(text) {
      try {
        const d = JSON.parse(text);
        const rows = Array.isArray(d) ? d : (d.result ?? []);
        if (!rows.length) return 'Khong co lenh sua chua nao.';
        return rows.slice(0, 10).map((x) => `${x.id} | xe: ${x.xe_id} | trang_thai: ${x.trang_thai} | ngay: ${x.ngay}`).join('\n');
      } catch { return text; }
    },
  },
  {
    q: 'Tình hình vật tư trong kho?',
    fn: 'vattuList',
    args: {},
    summarize(text) {
      try {
        const d = JSON.parse(text);
        const rows = Array.isArray(d) ? d : (d.result ?? []);
        if (!rows.length) return 'Kho trong.';
        return rows.slice(0, 8).map((x) => `${x.ten ?? x.id} | ton: ${x.ton ?? x.ton_kho ?? '?'} ${x.don_vi ?? ''}`).join('\n');
      } catch { return text; }
    },
  },
  {
    q: 'Hoạt động gần đây của người dùng?',
    fn: 'activityFeed',
    args: { limit: 5 },
    summarize(text) {
      try {
        const d = JSON.parse(text);
        const rows = Array.isArray(d) ? d : (d.result ?? []);
        if (!rows.length) return 'Chua co hoat dong.';
        return rows.slice(0, 5).map((x) => `[${x.ts}] ${x.actor_id ?? '?'}: ${x.hanh_dong} -> ${x.doi_tuong ?? ''} ${x.doi_tuong_id ?? ''}`).join('\n');
      } catch { return text; }
    },
  },
];

// ─── chay demo ───────────────────────────────────────────────────
const md = [];   // noi dung file output markdown
md.push('# MCP UAT Demo — 5 Cau Hoi Tieng Viet\n');
md.push(`> Thoi gian: ${new Date().toISOString()}`);
md.push(`> MCP Server: mcp-server/index.ts (stdio)`);
md.push(`> sc_id thuc: ${scId}\n`);

try {
  console.log('[mcp] Dang ket noi MCP server...');
  await client.connect(transport);
  console.log('[mcp] Ket noi thanh cong ✅');
  md.push('## Ket noi MCP ✅\n');

  // Liet ke tools
  try {
    const tl = await client.listTools();
    const names = (tl.tools ?? []).map((t) => t.name);
    md.push(`> So luong tools: ${names.length}\n`);
  } catch { /* listTools khong bat buoc */ }

  // Chay tung cau hoi
  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, fn, args, summarize } = QUESTIONS[i];
    const argsObj = typeof args === 'function' ? args() : args;
    console.log(`\n[mcp] Cau ${i + 1}: ${q}`);

    md.push(`---\n## Cau ${i + 1}: ${q}\n`);
    md.push(`**Q:** ${q}\n`);

    try {
      const result = await client.callTool({ name: fn, arguments: argsObj });
      // result.content = [{ type: 'text', text: '...' }]
      const text = result?.content?.[0]?.text ?? JSON.stringify(result);
      const summary = summarize(text);
      md.push(`**Tool:** \`${fn}(${JSON.stringify(argsObj)})\`\n`);
      md.push(`**A:** ${summary}\n`);
      console.log(`[mcp]   -> ${summary.split('\n')[0]}`);
    } catch (e) {
      md.push(`**A:** ❌ Loi: ${e.message}\n`);
      console.error(`[mcp]   -> ERROR: ${e.message}`);
    }
  }
} catch (e) {
  console.error('[mcp] Ket noi that bai:', e.message);
  md.push(`\n## Loi ket noi: ${e.message}\n`);
} finally {
  try { await client.close(); } catch { /* ignore */ }
}

// ─── ghi file output ─────────────────────────────────────────────
const outPath = join(__dirname, 'mcp_demo_output.md');
writeFileSync(outPath, md.join('\n'), 'utf8');

const qaCount = (md.join('\n').match(/^## Cau \d/gm) || []).length;
console.log(`\n✅ Ghi file: ${outPath}`);
console.log(`   So cau hoi: ${qaCount}`);
