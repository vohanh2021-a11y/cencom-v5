/**
 * mcp-server/index.ts — MCP Server (stdio)
 *
 * NGUYÊN TẮC ĐỒNG NHẤT (ANTI-CONFUSION CONTRACT):
 *   - Tool name === RPC fn name từng ký tự (hoSoCheck, KHÔNG phải hoso_check)
 *   - version === package.json version (đọc 1 lần, dùng ở banner)
 *   - tool-docs.ts: nguồn duy nhất cho description (thiếu fn → throw khởi động)
 *   - Permission: META[fn] → Auth RBAC → core can() là trọng tài cuối cùng
 *
 * Chạy: npx tsx mcp-server/index.ts (hoặc npm run mcp)
 */

// ─── CRITICAL: env MUST be imported BEFORE anything that touches process.env ───
// lib/db.ts reads process.env.DATABASE_URL at import time.
import './env';

import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getRegistry } from '../lib/rpc';
import { buildApi } from '../lib/api';
import { resolveActor } from './auth';
import { registerAll } from './server-core';
import { registerResources, registerPrompts } from './resources';

/* ──────────────────────────────────────────────────────────────
 * Main — async to handle resolveActor() + server.connect()
 *
 * W1.8a: vòng đăng ký tool chuyển nguyên vẹn vào server-core.registerAll
 * (HTTP mode http.ts dùng CÙNG hàm — chống fork logic, điểm 3.4).
 * ────────────────────────────────────────────────────────────── */

async function main() {
  // ─── 1. Read version ────────────────────────────────────────
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { version: string };
  const VERSION: string = pkg.version;

  // ─── 2. Auth + API + Registry ───────────────────────────────
  const actor = await resolveActor();
  const api = buildApi(actor);
  const reg = getRegistry();

  // ─── 4. Build MCP server ────────────────────────────────────
  const server = new McpServer({
    name: 'cencom-gara-v5',
    version: VERSION,
  });

  // ─── 5. Register every tool from registry (docs-gate inside) ──
  const toolNames = await registerAll(server, api, reg, actor);

  // ─── 5b. Register MCP resources & prompts (TM7 / M2) ──────────
  // Resource templates sc://{sc_id}, xe://{xe_id} + prompt QC206 guide.
  // RBAC vẫn do core handlers (checkHoSo/scGet/xeGet) trọng tài.
  await registerResources(server, api);
  await registerPrompts(server);

  // ─── 6. Connect & start ─────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Banner on stderr (stdout is reserved for JSON-RPC)
  process.stderr.write(
    `MCP cencom-gara-v5 v${VERSION} ready (${toolNames.length} tools, actor=${actor.name} role=${actor.role} write=${process.env.MCP_WRITE_TOOLS || ''})\n`,
  );
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('MCP fatal:', msg);
  process.exit(1);
});
