/**
 * mcp-server/server-core.ts — W1.8a: nhân đăng ký tool CHUNG cho stdio + HTTP
 *
 * Tách từ `index.ts` §3–§5 (điểm 3.4, docs/convergence/00_CAU_TRUC_HE_THONG.md):
 * vòng đăng ký tool từng bị copy ở cả `index.ts` và `http.ts`
 * (`createServerInstance`) → sửa một quên một. Nay MỘT nguồn duy nhất:
 * `registerAll()` — hành vi GIỮ NGUYÊN 100% so với loop cũ:
 *   - docs-gate: thiếu TOOL_DOCS[fn] → throw `[MCP BOOT] Missing TOOL_DOCS entry ...`
 *   - description: `[vi] ... | [en] ... | perm: ... | mode: ...`
 *   - WRITE guard: `doc.mode === 'WRITE' && !isWriteAllowed(fn)` → audit fail +
 *     `'403 write tool disabled: fn'` (isError) TRƯỚC khi chạm core
 *   - auditMcpCall(fn, actor, ok|fail) cho mọi call (kể cả denied)
 *   - registerTool cast `any` để lách SDK generic depth limit (approach (b))
 *
 * Resource/prompt KHÔNG nằm ở đây — `resources.ts` (registerResources/registerPrompts)
 * gọi riêng sau registerAll, vì index.ts/http.ts cùng pattern:
 *   registerAll → registerResources(server, api) → registerPrompts(server) → connect.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Actor, Api } from '../lib/types';
import { isWriteAllowed, auditMcpCall } from './auth';
import { TOOL_DOCS } from './tool-docs';
import { getToolInputSchema } from '../lib/contracts';

/** Registry shape trả về từ lib/rpc.getRegistry() (type-only — không import runtime). */
export type Registry = ReturnType<typeof import('../lib/rpc').getRegistry>;

/** FN_LIST \ OPEN — danh sách fn trở thành MCP tool (dùng chung cho gate + banner). */
export function computeToolNames(reg: Registry): string[] {
  return reg.FN_LIST.filter((fn: string) => !reg.OPEN.has(fn));
}

/**
 * Docs-completeness gate: thiếu docs → hard fail (message giữ nguyên từng ký tự
 * với boot gate cũ). Export riêng để `http.ts` main() fail-fast TRƯỚC khi bind
 * port, còn `registerAll` gọi lại nội bộ cho mọi server-per-session.
 */
export function assertDocsComplete(toolNames: string[]): void {
  for (const fn of toolNames) {
    if (!TOOL_DOCS[fn]) {
      throw new Error(
        `[MCP BOOT] Missing TOOL_DOCS entry for "${fn}". ` +
          `Add description to mcp-server/tool-docs.ts before starting.`,
      );
    }
  }
}

/**
 * Đăng ký TOÀN BỘ tool lên một McpServer instance (verbatim index.ts §5 loop).
 * Trả về danh sách tool đã đăng ký (để banner dùng `toolNames.length`).
 */
export async function registerAll(
  server: McpServer,
  api: Api,
  reg: Registry,
  actor: Actor,
): Promise<string[]> {
  // ─── 3. Compute tool list: FN_LIST \ OPEN, must have docs ───
  const toolNames = computeToolNames(reg);

  // Docs-completeness gate: missing docs → hard fail at startup
  assertDocsComplete(toolNames);

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

  return toolNames;
}
