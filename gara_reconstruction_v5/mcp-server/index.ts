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
import { resolveActor, isWriteAllowed, auditMcpCall } from './auth';
import { TOOL_DOCS } from './tool-docs';
import { getToolInputSchema } from '../lib/contracts';

/* ──────────────────────────────────────────────────────────────
 * Main — async to handle resolveActor() + server.connect()
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

  // ─── 3. Compute tool list: FN_LIST \ OPEN, must have docs ───
  const toolNames = reg.FN_LIST.filter((fn) => !reg.OPEN.has(fn));

  // Docs-completeness gate: missing docs → hard fail at startup
  for (const fn of toolNames) {
    if (!TOOL_DOCS[fn]) {
      throw new Error(
        `[MCP BOOT] Missing TOOL_DOCS entry for "${fn}". ` +
          `Add description to mcp-server/tool-docs.ts before starting.`,
      );
    }
  }

  // ─── 4. Build MCP server ────────────────────────────────────
  const server = new McpServer({
    name: 'cencom-gara-v5',
    version: VERSION,
  });

  // ─── 5. Register every tool from registry ───────────────────
  //
  // APPROACH (b): registerTool with z.record(z.unknown()) as inputSchema.
  // Chosen because:
  //   - z.object({}).passthrough() causes TS2589 (deep type recursion) with SDK generics
  //   - registerTool accepts AnySchema (which z.record() satisfies)
  //   - Cast bypasses generic depth limit while RBAC + validation happen in core layer
  //
  for (const fn of toolNames) {
    const doc = TOOL_DOCS[fn];
    const meta = reg.META[fn];
    const perm = meta ? meta.join('.') : 'UNKNOWN';
    const mode = doc.mode;

    const description =
      `[vi] ${doc.descVi} | [en] ${doc.descEn} | perm: ${perm} | mode: ${mode}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = async (args: Record<string, unknown>): Promise<any> => {
      // WRITE guard: check MCP_WRITE_TOOLS allowlist BEFORE calling handler
      if (doc.mode === 'WRITE' && !isWriteAllowed(fn)) {
        await auditMcpCall(fn, actor, false);
        return {
          content: [
            {
              type: 'text' as const,
              text: `403 write tool disabled: ${fn}`,
            },
          ],
          isError: true,
        };
      }

      try {
        // Call core handler directly — RBAC is enforced inside handlers
        const result = await reg.HANDLERS[fn](api, args || {});
        await auditMcpCall(fn, actor, true);
        return {
          content: [
            // Guard: JSON.stringify(undefined) returns undefined (not string),
            // which fails SDK's CallToolResultSchema validation.
            { type: 'text' as const, text: JSON.stringify(result ?? null, null, 2) },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await auditMcpCall(fn, actor, false);
        return {
          content: [
            { type: 'text' as const, text: `ERROR: ${message}` },
          ],
          isError: true,
        };
      }
    };

    // Register with cast to bypass SDK generic depth limit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server.registerTool as any)(
      fn,
      { title: doc.title, description, inputSchema: getToolInputSchema(fn) },
      handler,
    );
  }

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
